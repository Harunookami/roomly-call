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
import { ChatStore } from "./chat.ts";
import { normalizeRoomCode, RoomStore } from "./rooms.ts";

type SocketData = {
  code?: string;
  participantId?: string;
};

type RoomlySocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export type RoomlyServerOptions = {
  iceServers: IceServer[];
  // Tempo que um participante desconectado mantém o lugar na sala.
  reconnectGraceMs?: number;
  // Tempo que uma sala vazia continua existindo antes de ser apagada.
  emptyRoomTtlMs?: number;
  staticDir?: string;
};

export function createRoomlyServer({
  iceServers,
  reconnectGraceMs = 30_000,
  emptyRoomTtlMs = 60_000,
  staticDir,
}: RoomlyServerOptions) {
  const app = express();
  const chat = new ChatStore();

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.get("/chat-images/:id", (request, response) => {
    const image = chat.getImage(request.params.id);

    if (!image) {
      response.sendStatus(404);
      return;
    }

    response
      .set({
        "Content-Type": image.contentType,
        "Content-Security-Policy": "default-src 'none'",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=3600",
      })
      .send(image.data);
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
  });

  const store = new RoomStore();
  const removalTimers = new Map<string, NodeJS.Timeout>();
  const roomTimers = new Map<string, NodeJS.Timeout>();

  const cancelTimer = (timers: Map<string, NodeJS.Timeout>, key: string) => {
    clearTimeout(timers.get(key));
    timers.delete(key);
  };

  const scheduleRoomCleanup = (code: string) => {
    cancelTimer(roomTimers, code);
    roomTimers.set(
      code,
      setTimeout(() => {
        roomTimers.delete(code);

        if (store.isEmpty(code)) {
          store.deleteRoom(code);
          chat.deleteRoom(code);
        }
      }, emptyRoomTtlMs)
    );
  };

  const removeParticipant = (code: string, participantId: string) => {
    cancelTimer(removalTimers, participantId);

    const result = store.remove(code, participantId);

    if (!result) {
      return;
    }

    io.to(code).emit("participant:left", participantId);

    if (result.newHost) {
      io.to(code).emit("participant:updated", result.newHost);
    }

    if (result.roomEmpty) {
      scheduleRoomCleanup(code);
    }
  };

  const detachSocket = (socket: RoomlySocket) => {
    const { code } = socket.data;

    if (code) {
      socket.leave(code);
    }

    socket.data = {};
  };

  io.on("connection", (socket: RoomlySocket) => {
    socket.on("room:create", (ack) => {
      if (typeof ack !== "function") {
        return;
      }

      const code = store.createRoom();

      scheduleRoomCleanup(code);
      ack({ code });
    });

    socket.on("room:join", (request, ack) => {
      if (typeof ack !== "function") {
        return;
      }

      const code = normalizeRoomCode(request?.code);

      if (socket.data.code && socket.data.participantId) {
        const { code: previous, participantId } = socket.data;

        detachSocket(socket);
        removeParticipant(previous, participantId);
      }

      const result = store.join(
        code,
        request?.name,
        socket.id,
        request?.reconnectToken
      );

      if (!result.ok) {
        ack(result);
        return;
      }

      const { participant, reconnectToken } = result.member;

      cancelTimer(removalTimers, participant.id);
      cancelTimer(roomTimers, code);

      socket.data = { code, participantId: participant.id };
      socket.join(code);

      socket
        .to(code)
        .emit(
          result.reattached ? "participant:updated" : "participant:joined",
          participant
        );

      ack({
        ok: true,
        selfId: participant.id,
        reconnectToken,
        participants: result.participants,
        messages: chat.getMessages(code),
        iceServers,
      });
    });

    socket.on("room:leave", () => {
      const { code, participantId } = socket.data;

      if (code && participantId) {
        detachSocket(socket);
        removeParticipant(code, participantId);
      }
    });

    socket.on("room:kick", (targetId) => {
      const { code, participantId } = socket.data;

      if (!code || !participantId || targetId === participantId) {
        return;
      }

      const self = store.getMember(code, participantId);
      const target = store.getMember(code, targetId);

      if (!self?.participant.isHost || !target) {
        return;
      }

      const targetSocket = io.sockets.sockets.get(target.socketId);

      if (targetSocket) {
        targetSocket.emit("room:kicked");
        detachSocket(targetSocket);
      }

      removeParticipant(code, target.participant.id);
    });

    socket.on("media:update", (media) => {
      const { code, participantId } = socket.data;

      if (!code || !participantId) {
        return;
      }

      const participant = store.updateMedia(code, participantId, media);

      if (participant) {
        io.to(code).emit("participant:updated", participant);
      }
    });

    // O servidor só repassa a mensagem: nunca interpreta SDP nem candidatos ICE.
    socket.on("signal", (message) => {
      const { code, participantId } = socket.data;

      if (!code || !participantId) {
        return;
      }

      const target = store.getMember(code, message?.to);

      if (target) {
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

      const { code, participantId } = socket.data;
      const member =
        code && participantId ? store.getMember(code, participantId) : null;

      if (!code || !member) {
        ack({ ok: false, error: "not-in-room" });
        return;
      }

      const result = chat.send(
        code,
        { id: member.participant.id, name: member.participant.name },
        request
      );

      if (!result.ok) {
        ack(result);
        return;
      }

      io.to(code).emit("chat:message", result.message);
      ack({ ok: true });
    });

    socket.on("chat:typing", (typing) => {
      const { code, participantId } = socket.data;

      if (code && participantId) {
        socket
          .to(code)
          .emit("chat:typing", { participantId, typing: typing === true });
      }
    });

    socket.on("chat:react", (reaction) => {
      const { code, participantId } = socket.data;

      if (!code || !participantId) {
        return;
      }

      const message = chat.toggleReaction(
        code,
        participantId,
        reaction?.messageId,
        reaction?.emoji
      );

      if (message) {
        io.to(code).emit("chat:updated", message);
      }
    });

    socket.on("disconnect", () => {
      const { code, participantId } = socket.data;

      if (!code || !participantId) {
        return;
      }

      const participant = store.markDisconnected(
        code,
        participantId,
        socket.id
      );

      if (!participant) {
        return;
      }

      io.to(code).emit("participant:updated", participant);

      removalTimers.set(
        participantId,
        setTimeout(() => {
          if (!store.isConnected(code, participantId)) {
            removeParticipant(code, participantId);
          }
        }, reconnectGraceMs)
      );
    });
  });

  const close = async () => {
    for (const timer of [...removalTimers.values(), ...roomTimers.values()]) {
      clearTimeout(timer);
    }

    await io.close();
  };

  return { httpServer, close };
}
