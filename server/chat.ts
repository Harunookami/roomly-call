import { randomUUID } from "node:crypto";

import {
  MAX_IMAGE_BYTES,
  MAX_MESSAGE_LENGTH,
  REACTION_EMOJIS,
  type ChatMessage,
  type ChatSendError,
  type ChatSendRequest,
} from "../src/types/Chat.ts";

const MAX_MESSAGES_PER_ROOM = 500;
const MAX_IMAGE_BYTES_PER_ROOM = 30_000_000;
const MAX_IMAGE_BYTES_TOTAL = 256_000_000;
const REPLY_PREVIEW_LENGTH = 100;

const RATE_WINDOW_MS = 10_000;
const MAX_MESSAGES_PER_WINDOW = 10;
const MAX_REACTIONS_PER_WINDOW = 30;

type StoredImage = {
  data: Buffer;
  contentType: string;
};

type RoomChat = {
  messages: ChatMessage[];
  imageBytes: number;
  rateLog: Map<string, number[]>;
};

type Author = {
  id: string;
  name: string;
};

export type ChatSendResult =
  | { ok: true; message: ChatMessage }
  | { ok: false; error: ChatSendError };

// Confere o conteúdo real do arquivo: o tipo informado pelo cliente não é confiável,
// e formatos como SVG poderiam executar scripts ao serem abertos.
function detectImageType(data: Buffer) {
  const startsWith = (...bytes: number[]) =>
    bytes.every((byte, index) => data[index] === byte);

  if (startsWith(0x89, 0x50, 0x4e, 0x47)) {
    return "image/png";
  }

  if (startsWith(0xff, 0xd8, 0xff)) {
    return "image/jpeg";
  }

  if (data.subarray(0, 4).toString("latin1") === "GIF8") {
    return "image/gif";
  }

  if (
    data.subarray(0, 4).toString("latin1") === "RIFF" &&
    data.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

export class ChatStore {
  private rooms = new Map<string, RoomChat>();
  private images = new Map<string, StoredImage>();
  private totalImageBytes = 0;

  getMessages(code: string) {
    return this.rooms.get(code)?.messages ?? [];
  }

  getImage(id: string) {
    return this.images.get(id);
  }

  send(code: string, author: Author, request: ChatSendRequest): ChatSendResult {
    const room = this.getRoom(code);
    const text = typeof request?.text === "string" ? request.text.trim() : "";
    const rawImage: unknown = request?.image;
    const image = Buffer.isBuffer(rawImage) ? rawImage : null;

    if (!text && !image) {
      return { ok: false, error: rawImage ? "invalid-image" : "empty" };
    }

    if (text.length > MAX_MESSAGE_LENGTH) {
      return { ok: false, error: "too-long" };
    }

    if (!this.allow(room, `message:${author.id}`, MAX_MESSAGES_PER_WINDOW)) {
      return { ok: false, error: "rate-limited" };
    }

    let imageUrl: string | null = null;

    if (image) {
      const stored = this.storeImage(room, image);

      if ("error" in stored) {
        return { ok: false, error: stored.error };
      }

      imageUrl = stored.url;
    }

    const replied = room.messages.find(
      (message) => message.id === request?.replyToId
    );

    const message: ChatMessage = {
      id: randomUUID(),
      authorId: author.id,
      authorName: author.name,
      text,
      imageUrl,
      replyTo: replied
        ? {
            id: replied.id,
            authorName: replied.authorName,
            text: replied.text.slice(0, REPLY_PREVIEW_LENGTH),
          }
        : null,
      reactions: {},
      createdAt: Date.now(),
    };

    room.messages.push(message);

    if (room.messages.length > MAX_MESSAGES_PER_ROOM) {
      this.releaseImage(room, room.messages.shift()?.imageUrl);
    }

    return { ok: true, message };
  }

  toggleReaction(
    code: string,
    participantId: string,
    messageId: unknown,
    emoji: unknown
  ) {
    const room = this.rooms.get(code);
    const message = room?.messages.find(({ id }) => id === messageId);

    if (
      !room ||
      !message ||
      typeof emoji !== "string" ||
      !REACTION_EMOJIS.includes(emoji) ||
      !this.allow(room, `reaction:${participantId}`, MAX_REACTIONS_PER_WINDOW)
    ) {
      return null;
    }

    const reactors = message.reactions[emoji] ?? [];
    const updated = reactors.includes(participantId)
      ? reactors.filter((id) => id !== participantId)
      : [...reactors, participantId];

    if (updated.length > 0) {
      message.reactions[emoji] = updated;
    } else {
      delete message.reactions[emoji];
    }

    return message;
  }

  deleteRoom(code: string) {
    const room = this.rooms.get(code);

    for (const message of room?.messages ?? []) {
      if (room) {
        this.releaseImage(room, message.imageUrl);
      }
    }

    this.rooms.delete(code);
  }

  private getRoom(code: string) {
    let room = this.rooms.get(code);

    if (!room) {
      room = { messages: [], imageBytes: 0, rateLog: new Map() };
      this.rooms.set(code, room);
    }

    return room;
  }

  private storeImage(
    room: RoomChat,
    data: Buffer
  ): { url: string } | { error: ChatSendError } {
    const contentType = detectImageType(data);

    if (!contentType) {
      return { error: "invalid-image" };
    }

    if (data.length > MAX_IMAGE_BYTES) {
      return { error: "image-too-large" };
    }

    if (
      room.imageBytes + data.length > MAX_IMAGE_BYTES_PER_ROOM ||
      this.totalImageBytes + data.length > MAX_IMAGE_BYTES_TOTAL
    ) {
      return { error: "image-limit" };
    }

    const id = randomUUID();

    this.images.set(id, { data, contentType });
    room.imageBytes += data.length;
    this.totalImageBytes += data.length;

    return { url: `/chat-images/${id}` };
  }

  private releaseImage(room: RoomChat, imageUrl: string | null | undefined) {
    const id = imageUrl?.split("/").pop();
    const image = id ? this.images.get(id) : undefined;

    if (id && image) {
      this.images.delete(id);
      room.imageBytes -= image.data.length;
      this.totalImageBytes -= image.data.length;
    }
  }

  private allow(room: RoomChat, key: string, limit: number) {
    const now = Date.now();
    const recent = (room.rateLog.get(key) ?? []).filter(
      (time) => now - time < RATE_WINDOW_MS
    );

    if (recent.length >= limit) {
      return false;
    }

    room.rateLog.set(key, [...recent, now]);

    return true;
  }
}
