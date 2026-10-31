import type {
  ChatMessage,
  ChatPage,
  ChatSendRequest,
  ChatSendResponse,
} from "./Chat.ts";
import type { MediaState, Participant } from "./Participant.ts";

export const ROOM_NAME = "Nossa sala";
export const MAX_PARTICIPANTS = 8;
export const MAX_NAME_LENGTH = 40;

export type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

export type JoinRequest = {
  name: string;
  reconnectToken?: string;
};

export type JoinError = "full" | "invalid-name";

export type JoinResponse =
  | {
      ok: true;
      selfId: string;
      reconnectToken: string;
      participants: Participant[];
      messages: ChatMessage[];
      hasMoreMessages: boolean;
      iceServers: IceServer[];
    }
  | { ok: false; error: JoinError };

export type ClientToServerEvents = {
  "room:join": (
    request: JoinRequest,
    ack: (response: JoinResponse) => void
  ) => void;
  "room:leave": () => void;
  "room:kick": (participantId: string) => void;
  "media:update": (media: MediaState) => void;
  signal: (message: { to: string; data: unknown }) => void;
  "chat:send": (
    request: ChatSendRequest,
    ack: (response: ChatSendResponse) => void
  ) => void;
  "chat:history": (before: string, ack: (page: ChatPage) => void) => void;
  "chat:typing": (typing: boolean) => void;
  "chat:react": (reaction: { messageId: string; emoji: string }) => void;
};

export type ServerToClientEvents = {
  "participant:joined": (participant: Participant) => void;
  "participant:updated": (participant: Participant) => void;
  "participant:left": (participantId: string) => void;
  "room:kicked": () => void;
  signal: (message: { from: string; data: unknown }) => void;
  "chat:message": (message: ChatMessage) => void;
  "chat:updated": (message: ChatMessage) => void;
  "chat:typing": (status: { participantId: string; typing: boolean }) => void;
};
