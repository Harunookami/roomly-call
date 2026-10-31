import { randomBytes, randomInt, randomUUID } from "node:crypto";

import type { MediaState, Participant } from "../src/types/Participant.ts";
import {
  MAX_NAME_LENGTH,
  MAX_PARTICIPANTS,
  type JoinError,
} from "../src/types/Room.ts";

// Sem caracteres ambíguos (0/O, 1/I/L) para facilitar ditar o código.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

type Member = {
  participant: Participant;
  reconnectToken: string;
  socketId: string;
};

type Room = {
  code: string;
  members: Map<string, Member>;
};

export type JoinResult =
  | {
      ok: true;
      member: Member;
      reattached: boolean;
      participants: Participant[];
    }
  | { ok: false; error: JoinError };

export type RemoveResult = {
  removed: Participant;
  newHost: Participant | null;
  roomEmpty: boolean;
};

export function normalizeRoomCode(code: unknown) {
  return typeof code === "string" ? code.trim().toUpperCase() : "";
}

export class RoomStore {
  private rooms = new Map<string, Room>();

  createRoom() {
    let code: string;

    do {
      code = Array.from(
        { length: CODE_LENGTH },
        () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
      ).join("");
    } while (this.rooms.has(code));

    this.rooms.set(code, { code, members: new Map() });

    return code;
  }

  deleteRoom(code: string) {
    this.rooms.delete(code);
  }

  isEmpty(code: string) {
    const room = this.rooms.get(code);

    return !room || room.members.size === 0;
  }

  join(
    code: string,
    rawName: unknown,
    socketId: string,
    reconnectToken?: unknown
  ): JoinResult {
    const room = this.rooms.get(code);

    if (!room) {
      return { ok: false, error: "not-found" };
    }

    const existing = [...room.members.values()].find(
      (member) => member.reconnectToken === reconnectToken
    );

    if (existing) {
      existing.socketId = socketId;
      existing.participant.connected = true;

      return {
        ok: true,
        member: existing,
        reattached: true,
        participants: this.participants(room),
      };
    }

    const name =
      typeof rawName === "string"
        ? rawName.trim().slice(0, MAX_NAME_LENGTH)
        : "";

    if (!name) {
      return { ok: false, error: "invalid-name" };
    }

    if (room.members.size >= MAX_PARTICIPANTS) {
      return { ok: false, error: "full" };
    }

    const member: Member = {
      socketId,
      reconnectToken: randomBytes(24).toString("hex"),
      participant: {
        id: randomUUID(),
        name,
        isHost: room.members.size === 0,
        connected: true,
        micOn: false,
        deafened: false,
        cameraOn: false,
        screenStreamId: null,
      },
    };

    room.members.set(member.participant.id, member);

    return {
      ok: true,
      member,
      reattached: false,
      participants: this.participants(room),
    };
  }

  // Devolve null quando o socket já foi substituído por uma reconexão mais nova.
  markDisconnected(code: string, participantId: string, socketId: string) {
    const member = this.rooms.get(code)?.members.get(participantId);

    if (!member || member.socketId !== socketId) {
      return null;
    }

    member.participant.connected = false;

    return member.participant;
  }

  isConnected(code: string, participantId: string) {
    return !!this.rooms.get(code)?.members.get(participantId)?.participant
      .connected;
  }

  remove(code: string, participantId: string): RemoveResult | null {
    const room = this.rooms.get(code);
    const member = room?.members.get(participantId);

    if (!room || !member) {
      return null;
    }

    room.members.delete(participantId);

    let newHost: Participant | null = null;

    if (member.participant.isHost && room.members.size > 0) {
      const members = [...room.members.values()];
      const next = members.find((m) => m.participant.connected) ?? members[0];

      next.participant.isHost = true;
      newHost = next.participant;
    }

    return {
      removed: member.participant,
      newHost,
      roomEmpty: room.members.size === 0,
    };
  }

  updateMedia(code: string, participantId: string, media: MediaState) {
    const member = this.rooms.get(code)?.members.get(participantId);

    if (!member) {
      return null;
    }

    member.participant.micOn = media?.micOn === true;
    member.participant.deafened = media?.deafened === true;
    member.participant.cameraOn = media?.cameraOn === true;
    member.participant.screenStreamId =
      typeof media?.screenStreamId === "string" ? media.screenStreamId : null;

    return member.participant;
  }

  getMember(code: string, participantId: unknown) {
    return typeof participantId === "string"
      ? this.rooms.get(code)?.members.get(participantId)
      : undefined;
  }

  private participants(room: Room) {
    return [...room.members.values()].map((member) => member.participant);
  }
}
