import type { AddressInfo } from "node:net";

import { io, type Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  MAX_PARTICIPANTS,
  type ClientToServerEvents,
  type JoinResponse,
  type ServerToClientEvents,
} from "../src/types/Room.ts";
import { createRoomlyServer } from "./app.ts";

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;
type JoinOk = Extract<JoinResponse, { ok: true }>;

const iceServers = [{ urls: "stun:stun.example.test:3478" }];

describe("servidor do Roomly", () => {
  let server: ReturnType<typeof createRoomlyServer>;
  let url: string;
  let clients: Client[];

  const connect = async () => {
    const client: Client = io(url, { reconnection: false });

    clients.push(client);
    await new Promise<void>((resolve) => client.once("connect", resolve));

    return client;
  };

  const createRoom = (client: Client) =>
    new Promise<string>((resolve) =>
      client.emit("room:create", ({ code }) => resolve(code))
    );

  const join = (client: Client, code: string, name: string, token?: string) =>
    new Promise<JoinResponse>((resolve) =>
      client.emit("room:join", { code, name, reconnectToken: token }, resolve)
    );

  const joinOk = async (client: Client, code: string, name: string) =>
    (await join(client, code, name)) as JoinOk;

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
    server = createRoomlyServer({
      iceServers,
      reconnectGraceMs: 50,
      emptyRoomTtlMs: 50,
    });

    await new Promise<void>((resolve) =>
      server.httpServer.listen(0, "127.0.0.1", resolve)
    );

    const { port } = server.httpServer.address() as AddressInfo;
    url = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    clients.forEach((client) => client.disconnect());
    await server.close();
  });

  it("cria a sala e torna o primeiro participante anfitrião", async () => {
    const client = await connect();
    const code = await createRoom(client);
    const response = await joinOk(client, code, "  Ana  ");

    expect(code).toMatch(/^[A-Z2-9]{8}$/);
    expect(response.iceServers).toEqual(iceServers);
    expect(response.participants).toHaveLength(1);
    expect(response.participants[0]).toMatchObject({
      name: "Ana",
      isHost: true,
    });
  });

  it("aceita o código em minúsculas", async () => {
    const client = await connect();
    const code = await createRoom(client);

    const response = await join(client, code.toLowerCase(), "Ana");

    expect(response.ok).toBe(true);
  });

  it("recusa sala inexistente e nome vazio", async () => {
    const client = await connect();
    const code = await createRoom(client);

    expect(await join(client, "NAOEXISTE", "Ana")).toEqual({
      ok: false,
      error: "not-found",
    });
    expect(await join(client, code, "   ")).toEqual({
      ok: false,
      error: "invalid-name",
    });
  });

  it("recusa entrada quando a sala está cheia", async () => {
    const owner = await connect();
    const code = await createRoom(owner);

    for (let i = 0; i < MAX_PARTICIPANTS; i++) {
      await join(await connect(), code, `Pessoa ${i}`);
    }

    expect(await join(await connect(), code, "Extra")).toEqual({
      ok: false,
      error: "full",
    });
  });

  it("repassa sinalização somente dentro da mesma sala", async () => {
    const ana = await connect();
    const bia = await connect();
    const intruso = await connect();
    const code = await createRoom(ana);

    const self = await joinOk(ana, code, "Ana");
    const other = await joinOk(bia, code, "Bia");
    await joinOk(intruso, await createRoom(intruso), "Intruso");

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
    const code = await createRoom(ana);

    await joinOk(ana, code, "Ana");
    const other = await joinOk(bia, code, "Bia");

    const left = nextEvent(bia, "participant:left");
    const updated = nextEvent(bia, "participant:updated");
    ana.emit("room:leave");

    await left;

    expect(await updated).toMatchObject({ id: other.selfId, isHost: true });
  });

  it("só o anfitrião pode remover participantes", async () => {
    const ana = await connect();
    const bia = await connect();
    const code = await createRoom(ana);

    const host = await joinOk(ana, code, "Ana");
    const guest = await joinOk(bia, code, "Bia");

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
    const code = await createRoom(ana);

    const first = await joinOk(ana, code, "Ana");
    await joinOk(bia, code, "Bia");

    let leftCount = 0;
    bia.on("participant:left", () => leftCount++);

    const offline = nextEvent(bia, "participant:updated");
    ana.disconnect();
    expect(await offline).toMatchObject({ id: first.selfId, connected: false });

    const online = nextEvent(bia, "participant:updated");
    const again = await connect();
    const second = (await join(
      again,
      code,
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
    const code = await createRoom(ana);

    const self = await joinOk(ana, code, "Ana");
    await joinOk(bia, code, "Bia");

    const left = nextEvent(bia, "participant:left");
    ana.disconnect();

    expect(await left).toBe(self.selfId);
  });

  it("apaga a sala depois que fica vazia", async () => {
    const ana = await connect();
    const code = await createRoom(ana);

    await joinOk(ana, code, "Ana");
    ana.emit("room:leave");

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(await join(ana, code, "Ana")).toEqual({
      ok: false,
      error: "not-found",
    });
  });
});
