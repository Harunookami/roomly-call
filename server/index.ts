import { join as joinPath } from "node:path";

import type { IceServer } from "../src/types/Room.ts";
import { createRoomlyServer } from "./app.ts";

const MIN_PASSWORD_LENGTH = 8;

function loadIceServers() {
  const iceServers: IceServer[] = [
    { urls: process.env.STUN_URL ?? "stun:stun.l.google.com:19302" },
  ];

  if (process.env.TURN_URL) {
    iceServers.push({
      urls: process.env.TURN_URL,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL,
    });
  }

  return iceServers;
}

// Em desenvolvimento a porta é fixa, porque é nela que o proxy do Vite espera o
// servidor, e há uma senha padrão para não exigir configuração.
const dev = process.argv.includes("--dev");
const port = dev ? 3001 : Number(process.env.PORT ?? 3001);
const password = process.env.ROOMLY_PASSWORD || (dev ? "roomly" : "");

if (!dev && password.length < MIN_PASSWORD_LENGTH) {
  console.error(
    `Defina ROOMLY_PASSWORD com pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`
  );
  process.exit(1);
}

const { httpServer } = createRoomlyServer({
  password,
  dataDir: process.env.DATA_DIR ?? joinPath(import.meta.dirname, "..", "data"),
  iceServers: loadIceServers(),
  staticDir: joinPath(import.meta.dirname, "..", "dist"),
});

httpServer.listen(port, () => {
  console.log(`Servidor do Roomly em http://localhost:${port}`);
});
