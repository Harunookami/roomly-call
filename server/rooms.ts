import { randomBytes, randomUUID } from "node:crypto";

import type { MediaState, Participant } from "../src/types/Participant.ts";
import {
  MAX_NAME_LENGTH,
  MAX_PARTICIPANTS,
  type JoinError,
} from "../src/types/Room.ts";

type Member = {
  participant: Participant;
  reconnectToken: string;
  socketId: string;
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
};

export class RoomStore {
  private members = new Map<string, Member>();

  join(
    rawName: unknown,
    socketId: string,
    reconnectToken?: unknown
  ): JoinResult {
    const existing = [...this.members.values()].find(
      (member) => member.reconnectToken === reconnectToken
    );

    if (existing) {
      existing.socketId = socketId;
      existing.participant.connected = true;

      return {
        ok: true,
        member: existing,
        reattached: true,
        participants: this.participants(),
      };
    }

    const name =
      typeof rawName === "string"
        ? rawName.trim().slice(0, MAX_NAME_LENGTH)
        : "";

    if (!name) {
      return { ok: false, error: "invalid-name" };
    }

    if (this.members.size >= MAX_PARTICIPANTS) {
      return { ok: false, error: "full" };
    }

    const member: Member = {
      socketId,
      reconnectToken: randomBytes(24).toString("hex"),
      participant: {
        id: randomUUID(),
        name,
        isHost: this.members.size === 0,
        connected: true,
        micOn: false,
        deafened: false,
        cameraOn: false,
        screenStreamId: null,
      },
    };

    this.members.set(member.participant.id, member);

    return {
      ok: true,
      member,
      reattached: false,
      participants: this.participants(),
    };
  }

  // Devolve null quando o socket já foi substituído por uma reconexão mais nova.
  markDisconnected(participantId: string, socketId: string) {
    const member = this.members.get(participantId);

    if (!member || member.socketId !== socketId) {
      return null;
    }

    member.participant.connected = false;

    return member.participant;
  }

  isConnected(participantId: string) {
    return !!this.members.get(participantId)?.participant.connected;
  }

  remove(participantId: string): RemoveResult | null {
    const member = this.members.get(participantId);

    if (!member) {
      return null;
    }

    this.members.delete(participantId);

    let newHost: Participant | null = null;

    if (member.participant.isHost && this.members.size > 0) {
      const members = [...this.members.values()];
      const next = members.find((m) => m.participant.connected) ?? members[0];

      next.participant.isHost = true;
      newHost = next.participant;
    }

    return { removed: member.participant, newHost };
  }

  updateMedia(participantId: string, media: MediaState) {
    const member = this.members.get(participantId);

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

  getMember(participantId: unknown) {
    return typeof participantId === "string"
      ? this.members.get(participantId)
      : undefined;
  }

  private participants() {
    return [...this.members.values()].map((member) => member.participant);
  }
}
