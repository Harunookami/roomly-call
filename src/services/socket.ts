import { io, type Socket } from "socket.io-client";

import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../types/Room";

export type RoomlySocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export const socket: RoomlySocket = io({ autoConnect: false });

export async function createRoom() {
  socket.connect();

  const { code } = await socket.timeout(8000).emitWithAck("room:create");

  return code;
}
