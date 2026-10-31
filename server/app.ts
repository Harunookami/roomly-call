import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { join as joinPath } from "node:path";

import express from "express";
import { Server, type Socket } from "socket.io";

import { MAX_IMAGE_BYTES } from "../src/types/Chat.ts";
import type {
  ClientToServerEvents,
  IceServer,
  ServerToClientEvents,
} from "../src/types/Room.ts";
import { SESSION_COOKIE, SESSION_MAX_AGE_MS, SessionAuth } from "./auth.ts";
import { ChatStore } from "./chat.ts";
import { RoomStore } from "./rooms.ts";

// Canal do Socket.IO que reúne todos os participantes da sala única.
const ROOM_CHANNEL = "room";

type SocketData = {
  participantId?: string;
};

type RoomlySocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export type RoomlyServerOptions = {
  password: string;
  dataDir: string;
  iceServers: IceServer[];
  // Tempo que um participante desconectado mantém o lugar na sala.
  reconnectGraceMs?: number;
  staticDir?: string;
};

export function createRoomlyServer({
  password,
  dataDir,
  iceServers,
  reconnectGraceMs = 30_000,
  staticDir,
}: RoomlyServerOptions) {
  const app = express();
  const auth = new SessionAuth(password);
  const chat = new ChatStore(dataDir);

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.get("/api/session", (request, response) => {
    response.json({ authenticated: auth.isAuthenticated(request.headers.cookie) });
  });

  app.post(
    "/api/login",
    express.json({ limit: "1kb" }),
    (request, response) => {
      const result = auth.login(request.body?.password);

      if (!result.ok) {
        response.status(result.error === "locked" ? 429 : 401).end();
        return;
      }

      response
        .cookie(SESSION_COOKIE, result.token, {
          httpOnly: true,
          sameSite: "strict",
          // Atrás do proxy da hospedagem, a conexão com o Express nunca é HTTPS.
          secure:
            request.secure || request.get("x-forwarded-proto") === "https",
          maxAge: SESSION_MAX_AGE_MS,
        })
        .status(204)
        .end();
    }
  );

  app.get("/chat-images/:id", (request, response) => {
    const image = auth.isAuthenticated(request.headers.cookie)
      ? chat.getImage(request.params.id)
      : undefined;

    if (!image) {
      response.sendStatus(404);
      return;
    }

    response.sendFile(image.path, {
      headers: {
        "Content-Type": image.contentType,
        "Content-Security-Policy": "default-src 'none'",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=3600",
      },
    });
  });

  if (staticDir && existsSync(joinPath(staticDir, "index.html"))) {
    app.use(express.static(staticDir));
    app.use((_request, response) => {
      response.sendFile(joinPath(staticDir, "index.html"));
    });
  }

  const httpServer = createServer(app);
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >(httpServer, {
    // Comporta uma imagem do chat, que cresce em base64 quando vai por polling.
    maxHttpBufferSize: 1.5 * MAX_IMAGE_BYTES,
    allowRequest: (request, callback) => {
      callback(null, auth.isAuthenticated(request.headers.cookie));
    },
  });

  const store = new RoomStore();
  const removalTimers = new Map<string, NodeJS.Timeout>();

  const cancelRemoval = (participantId: string) => {
    clearTimeout(removalTimers.get(participantId));
    removalTimers.delete(participantId);
  };

  const removeParticipant = (participantId: string) => {
    cancelRemoval(participantId);

    const result = store.remove(participantId);

    if (!result) {
      return;
    }

    io.to(ROOM_CHANNEL).emit("participant:left", participantId);

    if (result.newHost) {
      io.to(ROOM_CHANNEL).emit("participant:updated", result.newHost);
    }
  };

  const detachSocket = (socket: RoomlySocket) => {
    socket.leave(ROOM_CHANNEL);
    socket.data = {};
  };

  io.on("connection", (socket: RoomlySocket) => {
    const currentMember = () => store.getMember(socket.data.participantId);

    socket.on("room:join", (request, ack) => {
      if (typeof ack !== "function") {
        return;
      }

      if (socket.data.participantId) {
        const { participantId } = socket.data;

        detachSocket(socket);
        removeParticipant(participantId);
      }

      const result = store.join(
        request?.name,
        socket.id,
        request?.reconnectToken
      );

      if (!result.ok) {
        ack(result);
        return;
      }

      const { participant, reconnectToken } = result.member;

      cancelRemoval(participant.id);

      socket.data = { participantId: participant.id };
      socket.join(ROOM_CHANNEL);

      socket
        .to(ROOM_CHANNEL)
        .emit(
          result.reattached ? "participant:updated" : "participant:joined",
          participant
        );

      const { messages, hasMore } = chat.getPage();

      ack({
        ok: true,
        selfId: participant.id,
        reconnectToken,
        participants: result.participants,
        messages,
        hasMoreMessages: hasMore,
        iceServers,
      });
    });

    socket.on("room:leave", () => {
      const { participantId } = socket.data;

      if (participantId) {
        detachSocket(socket);
        removeParticipant(participantId);
      }
    });

    socket.on("room:kick", (targetId) => {
      const self = currentMember();
      const target = store.getMember(targetId);

      if (!self?.participant.isHost || !target || target === self) {
        return;
      }

      const targetSocket = io.sockets.sockets.get(target.socketId);

      if (targetSocket) {
        targetSocket.emit("room:kicked");
        detachSocket(targetSocket);
      }

      removeParticipant(target.participant.id);
    });

    socket.on("media:update", (media) => {
      const { participantId } = socket.data;
      const participant = participantId
        ? store.updateMedia(participantId, media)
        : null;

      if (participant) {
        io.to(ROOM_CHANNEL).emit("participant:updated", participant);
      }
    });

    // O servidor só repassa a mensagem: nunca interpreta SDP nem candidatos ICE.
    socket.on("signal", (message) => {
      const { participantId } = socket.data;
      const target = store.getMember(message?.to);

      if (participantId && target) {
        io.to(target.socketId).emit("signal", {
          from: participantId,
          data: message.data,
        });
      }
    });

    socket.on("chat:send", (request, ack) => {
      if (typeof ack !== "function") {
        return;
      }

      const member = currentMember();

      if (!member) {
        ack({ ok: false, error: "not-in-room" });
        return;
      }

      const result = chat.send(member.participant.name, request);

      if (!result.ok) {
        ack(result);
        return;
      }

      io.to(ROOM_CHANNEL).emit("chat:message", result.message);
      ack({ ok: true });
    });

    socket.on("chat:history", (before, ack) => {
      if (typeof ack === "function" && currentMember()) {
        ack(chat.getPage(before));
      }
    });

    socket.on("chat:typing", (typing) => {
      const { participantId } = socket.data;

      if (participantId) {
        socket
          .to(ROOM_CHANNEL)
          .emit("chat:typing", { participantId, typing: typing === true });
      }
    });

    socket.on("chat:react", (reaction) => {
      const member = currentMember();
      const message = member
        ? chat.toggleReaction(
            member.participant.name,
            reaction?.messageId,
            reaction?.emoji
          )
        : null;

      if (message) {
        io.to(ROOM_CHANNEL).emit("chat:updated", message);
      }
    });

    socket.on("disconnect", () => {
      const { participantId } = socket.data;
      const participant = participantId
        ? store.markDisconnected(participantId, socket.id)
        : null;

      if (!participantId || !participant) {
        return;
      }

      io.to(ROOM_CHANNEL).emit("participant:updated", participant);

      removalTimers.set(
        participantId,
        setTimeout(() => {
          if (!store.isConnected(participantId)) {
            removeParticipant(participantId);
          }
        }, reconnectGraceMs)
      );
    });
  });

  const close = async () => {
    for (const timer of removalTimers.values()) {
      clearTimeout(timer);
    }

    await io.close();
    chat.close();
  };

  return { httpServer, close };
}
