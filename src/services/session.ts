export type LoginResult = "ok" | "wrong-password" | "locked" | "unavailable";

export async function checkSession() {
  const response = await fetch("/api/session");
  const { authenticated } = await response.json();

  return authenticated === true;
}

export async function login(password: string): Promise<LoginResult> {
  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (response.ok) {
      return "ok";
    }

    if (response.status === 401) {
      return "wrong-password";
    }

    return response.status === 429 ? "locked" : "unavailable";
  } catch {
    return "unavailable";
  }
}
