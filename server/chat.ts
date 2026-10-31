import { randomUUID } from "node:crypto";
import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join as joinPath } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  CHAT_PAGE_SIZE,
  MAX_IMAGE_BYTES,
  MAX_MESSAGE_LENGTH,
  REACTION_EMOJIS,
  type ChatMessage,
  type ChatSendError,
  type ChatSendRequest,
} from "../src/types/Chat.ts";

const MAX_IMAGE_BYTES_TOTAL = 5_000_000_000;
const REPLY_PREVIEW_LENGTH = 100;

const RATE_WINDOW_MS = 10_000;
const MAX_MESSAGES_PER_WINDOW = 10;
const MAX_REACTIONS_PER_WINDOW = 30;

type MessageRow = {
  id: string;
  author_name: string;
  text: string;
  image_id: string | null;
  reply_to: string | null;
  reactions: string;
  created_at: number;
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

function toMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    authorName: row.author_name,
    text: row.text,
    imageUrl: row.image_id ? `/chat-images/${row.image_id}` : null,
    replyTo: row.reply_to ? JSON.parse(row.reply_to) : null,
    reactions: JSON.parse(row.reactions),
    createdAt: row.created_at,
  };
}

export class ChatStore {
  private db: DatabaseSync;
  private imagesDir: string;
  private rateLog = new Map<string, number[]>();

  constructor(dataDir: string) {
    this.imagesDir = joinPath(dataDir, "images");
    mkdirSync(this.imagesDir, { recursive: true });

    this.db = new DatabaseSync(joinPath(dataDir, "roomly.db"));
    this.db.exec(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS messages (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL UNIQUE,
        author_name TEXT NOT NULL,
        text TEXT NOT NULL,
        image_id TEXT,
        reply_to TEXT,
        reactions TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS images (
        id TEXT PRIMARY KEY,
        content_type TEXT NOT NULL,
        size INTEGER NOT NULL
      );
    `);
  }

  // Devolve as mensagens mais recentes (ou as anteriores a `before`), da mais antiga
  // para a mais nova.
  getPage(before?: unknown) {
    const rows = (
      typeof before === "string"
        ? this.db
            .prepare(
              `SELECT * FROM messages
               WHERE seq < (SELECT seq FROM messages WHERE id = ?)
               ORDER BY seq DESC LIMIT ?`
            )
            .all(before, CHAT_PAGE_SIZE + 1)
        : this.db
            .prepare("SELECT * FROM messages ORDER BY seq DESC LIMIT ?")
            .all(CHAT_PAGE_SIZE + 1)
    ) as MessageRow[];

    return {
      messages: rows.slice(0, CHAT_PAGE_SIZE).reverse().map(toMessage),
      hasMore: rows.length > CHAT_PAGE_SIZE,
    };
  }

  getImage(id: string) {
    const row = this.db
      .prepare("SELECT content_type FROM images WHERE id = ?")
      .get(id) as { content_type: string } | undefined;

    return row
      ? { path: joinPath(this.imagesDir, id), contentType: row.content_type }
      : undefined;
  }

  send(authorName: string, request: ChatSendRequest): ChatSendResult {
    const text = typeof request?.text === "string" ? request.text.trim() : "";
    const rawImage: unknown = request?.image;
    const image = Buffer.isBuffer(rawImage) ? rawImage : null;

    if (!text && !image) {
      return { ok: false, error: rawImage ? "invalid-image" : "empty" };
    }

    if (text.length > MAX_MESSAGE_LENGTH) {
      return { ok: false, error: "too-long" };
    }

    if (!this.allow(`message:${authorName}`, MAX_MESSAGES_PER_WINDOW)) {
      return { ok: false, error: "rate-limited" };
    }

    let imageId: string | null = null;

    if (image) {
      const stored = this.storeImage(image);

      if ("error" in stored) {
        return { ok: false, error: stored.error };
      }

      imageId = stored.id;
    }

    const replied = this.findMessage(request?.replyToId);
    const replyTo = replied
      ? {
          id: replied.id,
          authorName: replied.authorName,
          text: replied.text.slice(0, REPLY_PREVIEW_LENGTH),
        }
      : null;
    const id = randomUUID();
    const createdAt = Date.now();

    this.db
      .prepare(
        `INSERT INTO messages
           (id, author_name, text, image_id, reply_to, reactions, created_at)
         VALUES (?, ?, ?, ?, ?, '{}', ?)`
      )
      .run(
        id,
        authorName,
        text,
        imageId,
        replyTo ? JSON.stringify(replyTo) : null,
        createdAt
      );

    return {
      ok: true,
      message: {
        id,
        authorName,
        text,
        imageUrl: imageId ? `/chat-images/${imageId}` : null,
        replyTo,
        reactions: {},
        createdAt,
      },
    };
  }

  toggleReaction(authorName: string, messageId: unknown, emoji: unknown) {
    const message = this.findMessage(messageId);

    if (
      !message ||
      typeof emoji !== "string" ||
      !REACTION_EMOJIS.includes(emoji) ||
      !this.allow(`reaction:${authorName}`, MAX_REACTIONS_PER_WINDOW)
    ) {
      return null;
    }

    const reactors = message.reactions[emoji] ?? [];
    const updated = reactors.includes(authorName)
      ? reactors.filter((name) => name !== authorName)
      : [...reactors, authorName];

    if (updated.length > 0) {
      message.reactions[emoji] = updated;
    } else {
      delete message.reactions[emoji];
    }

    this.db
      .prepare("UPDATE messages SET reactions = ? WHERE id = ?")
      .run(JSON.stringify(message.reactions), message.id);

    return message;
  }

  close() {
    this.db.close();
  }

  private findMessage(id: unknown) {
    if (typeof id !== "string") {
      return null;
    }

    const row = this.db
      .prepare("SELECT * FROM messages WHERE id = ?")
      .get(id) as MessageRow | undefined;

    return row ? toMessage(row) : null;
  }

  private storeImage(data: Buffer): { id: string } | { error: ChatSendError } {
    const contentType = detectImageType(data);

    if (!contentType) {
      return { error: "invalid-image" };
    }

    if (data.length > MAX_IMAGE_BYTES) {
      return { error: "image-too-large" };
    }

    const { total } = this.db
      .prepare("SELECT COALESCE(SUM(size), 0) AS total FROM images")
      .get() as { total: number };

    if (total + data.length > MAX_IMAGE_BYTES_TOTAL) {
      return { error: "image-limit" };
    }

    const id = randomUUID();
    const path = joinPath(this.imagesDir, id);

    writeFileSync(path, data);

    try {
      this.db
        .prepare("INSERT INTO images (id, content_type, size) VALUES (?, ?, ?)")
        .run(id, contentType, data.length);
    } catch (error) {
      unlinkSync(path);
      throw error;
    }

    return { id };
  }

  private allow(key: string, limit: number) {
    const now = Date.now();
    const recent = (this.rateLog.get(key) ?? []).filter(
      (time) => now - time < RATE_WINDOW_MS
    );

    if (recent.length >= limit) {
      return false;
    }

    this.rateLog.set(key, [...recent, now]);

    return true;
  }
}
