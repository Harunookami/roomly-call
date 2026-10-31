export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_IMAGE_BYTES = 1_000_000;
export const CHAT_PAGE_SIZE = 100;
export const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🎉"];

export type ChatReply = {
  id: string;
  authorName: string;
  text: string;
};

// A identidade no chat é o nome, porque ela precisa continuar valendo depois que a
// pessoa sai e volta. Só quem tem a senha da sala consegue escrever.
export type ChatMessage = {
  id: string;
  authorName: string;
  text: string;
  imageUrl: string | null;
  replyTo: ChatReply | null;
  // Emoji -> nomes de quem reagiu.
  reactions: Record<string, string[]>;
  createdAt: number;
};

export type ChatSendRequest = {
  text: string;
  replyToId?: string;
  image?: ArrayBuffer;
};

export type ChatSendError =
  | "empty"
  | "too-long"
  | "invalid-image"
  | "image-too-large"
  | "image-limit"
  | "rate-limited"
  | "not-in-room";

export type ChatSendResponse =
  | { ok: true }
  | { ok: false; error: ChatSendError };

export type ChatPage = {
  messages: ChatMessage[];
  hasMore: boolean;
};
