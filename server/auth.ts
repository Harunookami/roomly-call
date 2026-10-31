import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "roomly_session";
export const SESSION_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_LOGINS = 10;

function safeEqual(a: string, b: string) {
  const hash = (value: string) => createHash("sha256").update(value).digest();

  return timingSafeEqual(hash(a), hash(b));
}

// A sessão é derivada da senha: trocar a senha desconecta todos os aparelhos,
// e reiniciar o servidor não desconecta ninguém.
export class SessionAuth {
  private password: string;
  private token: string;
  private failedLogins: number[] = [];

  constructor(password: string) {
    this.password = password;
    this.token = createHmac("sha256", password)
      .update("roomly-session-v1")
      .digest("hex");
  }

  // O limite é global, e não por IP, porque o IP pode ser falsificado atrás de um
  // proxy. Durante o bloqueio, só novos logins param: quem já entrou continua.
  login(password: unknown) {
    const now = Date.now();

    this.failedLogins = this.failedLogins.filter(
      (time) => now - time < LOGIN_WINDOW_MS
    );

    if (this.failedLogins.length >= MAX_FAILED_LOGINS) {
      return { ok: false as const, error: "locked" as const };
    }

    if (typeof password !== "string" || !safeEqual(password, this.password)) {
      this.failedLogins.push(now);

      return { ok: false as const, error: "wrong-password" as const };
    }

    return { ok: true as const, token: this.token };
  }

  isAuthenticated(cookieHeader: string | undefined) {
    const prefix = `${SESSION_COOKIE}=`;
    const cookie = cookieHeader
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix));

    return !!cookie && safeEqual(cookie.slice(prefix.length), this.token);
  }
}
