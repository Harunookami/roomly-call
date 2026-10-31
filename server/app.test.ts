import { mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join as joinPath } from "node:path";

import { io, type Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  CHAT_PAGE_SIZE,
  MAX_IMAGE_BYTES,
  MAX_MESSAGE_LENGTH,
  REACTION_EMOJIS,
  type ChatPage,
  type ChatSendRequest,
  type ChatSendResponse,
} from "../src/types/Chat.ts";
import {
  MAX_PARTICIPANTS,
  type ClientToServerEvents,
  type JoinResponse,
  type ServerToClientEvents,
} from "../src/types/Room.ts";
import { createRoomlyServer } from "./app.ts";
import { ChatStore } from "./chat.ts";

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;
type JoinOk = Extract<JoinResponse, { ok: true }>;

const PASSWORD = "senha-de-teste";
const iceServers = [{ urls: "stun:stun.example.test:3478" }];

describe("servidor do Roomly", () => {
  let server: ReturnType<typeof createRoomlyServer>;
  let dataDir: string;
  let url: string;
  let cookie: string;
  let clients: Client[];

  const startServer = async () => {
    server = createRoomlyServer({
      password: PASSWORD,
      dataDir,
      iceServers,
      reconnectGraceMs: 50,
    });

    await new Promise<void>((resolve) =>
      server.httpServer.listen(0, "127.0.0.1", resolve)
    );

    const { port } = server.httpServer.address() as AddressInfo;
    url = `http://127.0.0.1:${port}`;
  };

  const login = (password: string, headers: Record<string, string> = {}) =>
    fetch(`${url}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ password }),
    });

  const connect = async () => {
    const client: Client = io(url, {
      reconnection: false,
      extraHeaders: { cookie },
    });

    clients.push(client);
    await new Promise<void>((resolve) => client.once("connect", resolve));

    return client;
  };

  const join = (client: Client, name: string, token?: string) =>
    new Promise<JoinResponse>((resolve) =>
      client.emit("room:join", { name, reconnectToken: token }, resolve)
    );

  const joinOk = async (client: Client, name: string) =>
    (await join(client, name)) as JoinOk;

  const nextEvent = <E extends keyof ServerToClientEvents>(
    client: Client,
    event: E
  ) =>
    new Promise<Parameters<ServerToClientEvents[E]>[0]>((resolve) => {
      const listener = (value: Parameters<ServerToClientEvents[E]>[0]) =>
        resolve(value);

      // O tipo do socket.io não consegue relacionar o evento genérico ao listener.
      (client.once as (e: string, l: typeof listener) => void)(event, listener);
    });

  beforeEach(async () => {
    clients = [];
    dataDir = mkdtempSync(joinPath(tmpdir(), "roomly-test-"));
    await startServer();

    const response = await login(PASSWORD);

    cookie = response.headers.get("set-cookie")!.split(";")[0];
  });

  afterEach(async () => {
    clients.forEach((client) => client.disconnect());
    await server.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  describe("senha de acesso", () => {
    it("define um cookie protegido ao acertar a senha", async () => {
      const response = await login(PASSWORD);
      const setCookie = response.headers.get("set-cookie");

      expect(response.status).toBe(204);
      expect(setCookie).toContain("HttpOnly");
      expect(setCookie).toContain("SameSite=Strict");
      expect(setCookie).not.toContain("Secure");
    });

    it("marca o cookie como seguro atrás de um proxy HTTPS", async () => {
      const response = await login(PASSWORD, {
        "x-forwarded-proto": "https",
      });

      expect(response.headers.get("set-cookie")).toContain("Secure");
    });

    it("recusa senha errada", async () => {
      const response = await login("senha-errada");

      expect(response.status).toBe(401);
      expect(response.headers.get("set-cookie")).toBeNull();
    });

    it("bloqueia novos logins após muitas tentativas, sem derrubar quem entrou", async () => {
      for (let i = 0; i < 10; i++) {
        expect((await login("senha-errada")).status).toBe(401);
      }

      expect((await login("senha-errada")).status).toBe(429);
      expect((await login(PASSWORD)).status).toBe(429);

      const response = await join(await connect(), "Ana");

      expect(response.ok).toBe(true);
    });

    it("informa se a sessão é válida", async () => {
      const check = async (headers: Record<string, string>) =>
        (await fetch(`${url}/api/session`, { headers })).json();

      expect(await check({})).toEqual({ authenticated: false });
      expect(await check({ cookie: "roomly_session=falso" })).toEqual({
        authenticated: false,
      });
      expect(await check({ cookie })).toEqual({ authenticated: true });
    });

    it("recusa a conexão em tempo real sem sessão", async () => {
      const client: Client = io(url, { reconnection: false });

      clients.push(client);

      await new Promise<void>((resolve, reject) => {
        client.once("connect", () => reject(new Error("conectou sem senha")));
        client.once("connect_error", () => resolve());
      });
    });

    it("mantém a sessão depois de reiniciar o servidor", async () => {
      await server.close();
      await startServer();

      const response = await fetch(`${url}/api/session`, {
        headers: { cookie },
      });

      expect(await response.json()).toEqual({ authenticated: true });
    });
  });

  describe("sala", () => {
    it("torna o primeiro participante anfitrião", async () => {
      const response = await joinOk(await connect(), "  Ana  ");

      expect(response.iceServers).toEqual(iceServers);
      expect(response.participants).toHaveLength(1);
      expect(response.participants[0]).toMatchObject({
        name: "Ana",
        isHost: true,
      });
    });

    it("recusa nome vazio", async () => {
      expect(await join(await connect(), "   ")).toEqual({
        ok: false,
        error: "invalid-name",
      });
    });

    it("recusa entrada quando a sala está cheia", async () => {
      for (let i = 0; i < MAX_PARTICIPANTS; i++) {
        await join(await connect(), `Pessoa ${i}`);
      }

      expect(await join(await connect(), "Extra")).toEqual({
        ok: false,
        error: "full",
      });
    });

    it("não repassa sinalização de quem não entrou", async () => {
      const ana = await connect();
      const bia = await connect();
      const intruso = await connect();

      const self = await joinOk(ana, "Ana");
      const other = await joinOk(bia, "Bia");

      const received: unknown[] = [];
      bia.on("signal", (message) => received.push(message));

      intruso.emit("signal", { to: other.selfId, data: "invasão" });
      ana.emit("signal", { to: other.selfId, data: "oferta" });

      await nextEvent(bia, "signal");

      expect(received).toEqual([{ from: self.selfId, data: "oferta" }]);
    });

    it("transfere o anfitrião quando ele sai", async () => {
      const ana = await connect();
      const bia = await connect();

      await joinOk(ana, "Ana");
      const other = await joinOk(bia, "Bia");

      const left = nextEvent(bia, "participant:left");
      const updated = nextEvent(bia, "participant:updated");
      ana.emit("room:leave");

      await left;

      expect(await updated).toMatchObject({ id: other.selfId, isHost: true });
    });

    it("só o anfitrião pode remover participantes", async () => {
      const ana = await connect();
      const bia = await connect();

      const host = await joinOk(ana, "Ana");
      const guest = await joinOk(bia, "Bia");

      let hostKicked = false;
      ana.on("room:kicked", () => (hostKicked = true));
      bia.emit("room:kick", host.selfId);

      const kicked = nextEvent(bia, "room:kicked");
      const left = nextEvent(ana, "participant:left");
      ana.emit("room:kick", guest.selfId);

      await kicked;

      expect(await left).toBe(guest.selfId);
      expect(hostKicked).toBe(false);
    });

    it("mantém o participante ao reconectar com o token", async () => {
      const ana = await connect();
      const bia = await connect();

      const first = await joinOk(ana, "Ana");
      await joinOk(bia, "Bia");

      let leftCount = 0;
      bia.on("participant:left", () => leftCount++);

      const offline = nextEvent(bia, "participant:updated");
      ana.disconnect();
      expect(await offline).toMatchObject({
        id: first.selfId,
        connected: false,
      });

      const online = nextEvent(bia, "participant:updated");
      const second = (await join(
        await connect(),
        "Ana",
        first.reconnectToken
      )) as JoinOk;

      expect(second.selfId).toBe(first.selfId);
      expect(await online).toMatchObject({ id: first.selfId, connected: true });

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(leftCount).toBe(0);
    });

    it("remove quem não volta dentro do prazo", async () => {
      const ana = await connect();
      const bia = await connect();

      const self = await joinOk(ana, "Ana");
      await joinOk(bia, "Bia");

      const left = nextEvent(bia, "participant:left");
      ana.disconnect();

      expect(await left).toBe(self.selfId);
    });

    it("continua aceitando entradas depois de ficar vazia", async () => {
      const ana = await connect();

      await joinOk(ana, "Ana");
      ana.emit("room:leave");
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect((await join(ana, "Ana")).ok).toBe(true);
    });
  });

  describe("chat", () => {
    // Menor PNG válido: 1x1 transparente.
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
      "base64"
    );

    const send = (
      client: Client,
      request: { text: string; replyToId?: string; image?: unknown }
    ) =>
      new Promise<ChatSendResponse>((resolve) =>
        client.emit("chat:send", request as ChatSendRequest, resolve)
      );

    const twoPeople = async () => {
      const ana = await connect();
      const bia = await connect();
      const anaJoin = await joinOk(ana, "Ana");
      const biaJoin = await joinOk(bia, "Bia");

      return { ana, bia, anaJoin, biaJoin };
    };

    it("entrega a mensagem a todos com autor e horário", async () => {
      const { ana, bia } = await twoPeople();
      const received = nextEvent(bia, "chat:message");
      const echoed = nextEvent(ana, "chat:message");

      expect(await send(ana, { text: "  oi  " })).toEqual({ ok: true });

      const message = await received;

      expect(message).toMatchObject({ text: "oi", authorName: "Ana" });
      expect(message.createdAt).toBeGreaterThan(0);
      expect(await echoed).toEqual(message);
    });

    it("recusa mensagem vazia, longa demais ou de quem está fora", async () => {
      const { ana } = await twoPeople();
      const fora = await connect();

      expect(await send(ana, { text: "   " })).toEqual({
        ok: false,
        error: "empty",
      });
      expect(
        await send(ana, { text: "x".repeat(MAX_MESSAGE_LENGTH + 1) })
      ).toEqual({ ok: false, error: "too-long" });
      expect(await send(fora, { text: "oi" })).toEqual({
        ok: false,
        error: "not-in-room",
      });
    });

    it("limita o envio em excesso", async () => {
      const { ana } = await twoPeople();
      const responses = [];

      for (let i = 0; i < 11; i++) {
        responses.push(await send(ana, { text: `mensagem ${i}` }));
      }

      expect(responses[9]).toEqual({ ok: true });
      expect(responses[10]).toEqual({ ok: false, error: "rate-limited" });
    });

    it("guarda um resumo da mensagem respondida", async () => {
      const { ana, bia } = await twoPeople();
      const first = nextEvent(bia, "chat:message");

      await send(ana, { text: "pergunta" });

      const { id } = await first;
      const second = nextEvent(ana, "chat:message");

      await send(bia, { text: "resposta", replyToId: id });

      expect((await second).replyTo).toEqual({
        id,
        authorName: "Ana",
        text: "pergunta",
      });
    });

    it("alterna reações pelo nome e ignora emoji fora da lista", async () => {
      const { ana, bia } = await twoPeople();
      const first = nextEvent(bia, "chat:message");

      await send(ana, { text: "oi" });

      const { id: messageId } = await first;
      const added = nextEvent(ana, "chat:updated");

      bia.emit("chat:react", { messageId, emoji: "🖕" });
      bia.emit("chat:react", { messageId, emoji: REACTION_EMOJIS[0] });

      expect((await added).reactions).toEqual({
        [REACTION_EMOJIS[0]]: ["Bia"],
      });

      const removed = nextEvent(ana, "chat:updated");

      bia.emit("chat:react", { messageId, emoji: REACTION_EMOJIS[0] });

      expect((await removed).reactions).toEqual({});
    });

    it("avisa os outros de quem está digitando, mas não a própria pessoa", async () => {
      const { ana, bia, anaJoin } = await twoPeople();
      let echoed = false;

      ana.on("chat:typing", () => (echoed = true));

      const typing = nextEvent(bia, "chat:typing");

      ana.emit("chat:typing", true);

      expect(await typing).toEqual({
        participantId: anaJoin.selfId,
        typing: true,
      });
      expect(echoed).toBe(false);
    });

    it("salva e serve a imagem só para quem tem sessão", async () => {
      const { ana, bia } = await twoPeople();
      const received = nextEvent(bia, "chat:message");

      expect(await send(ana, { text: "", image: png })).toEqual({ ok: true });

      const { imageUrl } = await received;
      const response = await fetch(`${url}${imageUrl}`, { headers: { cookie } });

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/png");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(Buffer.from(await response.arrayBuffer()).equals(png)).toBe(true);
      expect((await fetch(`${url}${imageUrl}`)).status).toBe(404);
    });

    it("recusa arquivos que não são imagem", async () => {
      const { ana } = await twoPeople();
      const svg = Buffer.from("<svg onload='alert(1)'></svg>");

      expect(await send(ana, { text: "", image: svg })).toEqual({
        ok: false,
        error: "invalid-image",
      });
    });

    it("recusa imagem acima do limite", async () => {
      const { ana } = await twoPeople();
      const big = Buffer.concat([png, Buffer.alloc(MAX_IMAGE_BYTES)]);

      expect(await send(ana, { text: "", image: big })).toEqual({
        ok: false,
        error: "image-too-large",
      });
    });

    it("não serve imagem inexistente nem caminhos de fora da pasta", async () => {
      const get = (path: string) =>
        fetch(`${url}/chat-images/${path}`, { headers: { cookie } });

      expect((await get("nao-existe")).status).toBe(404);
      expect((await get("..%2Froomly.db")).status).toBe(404);
    });

    it("não entrega histórico a quem não entrou", async () => {
      const { ana } = await twoPeople();
      const fora = await connect();
      let answered = false;

      await send(ana, { text: "segredo" });
      fora.emit("chat:history", "qualquer", () => (answered = true));
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(answered).toBe(false);
    });

    it("mantém mensagens, reações e imagens depois de reiniciar o servidor", async () => {
      const { ana, bia } = await twoPeople();
      const received = nextEvent(bia, "chat:message");

      await send(ana, { text: "guardada", image: png });

      const { id, imageUrl } = await received;
      const reacted = nextEvent(ana, "chat:updated");

      bia.emit("chat:react", { messageId: id, emoji: REACTION_EMOJIS[1] });
      await reacted;

      clients.forEach((client) => client.disconnect());
      await server.close();
      await startServer();

      const { messages } = await joinOk(await connect(), "Ana");

      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({
        id,
        text: "guardada",
        authorName: "Ana",
        reactions: { [REACTION_EMOJIS[1]]: ["Bia"] },
      });

      const image = await fetch(`${url}${imageUrl}`, { headers: { cookie } });

      expect(image.status).toBe(200);
    });

    it("entrega o histórico em páginas", async () => {
      await server.close();

      const seed = new ChatStore(dataDir);

      // Trocar de autor a cada 10 mensagens evita o limite de envio por pessoa.
      for (let i = 0; i < CHAT_PAGE_SIZE + 5; i++) {
        seed.send(`Pessoa ${Math.floor(i / 10)}`, { text: `m${i}` });
      }

      seed.close();
      await startServer();

      const client = await connect();
      const { messages, hasMoreMessages } = await joinOk(client, "Ana");

      expect(messages).toHaveLength(CHAT_PAGE_SIZE);
      expect(messages[0].text).toBe("m5");
      expect(messages.at(-1)?.text).toBe(`m${CHAT_PAGE_SIZE + 4}`);
      expect(hasMoreMessages).toBe(true);

      const older = await new Promise<ChatPage>((resolve) =>
        client.emit("chat:history", messages[0].id, resolve)
      );

      expect(older.messages.map((message) => message.text)).toEqual([
        "m0",
        "m1",
        "m2",
        "m3",
        "m4",
      ]);
      expect(older.hasMore).toBe(false);
    });
  });
});
