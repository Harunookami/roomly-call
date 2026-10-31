import { join as joinPath } from "node:path";

import type { IceServer } from "../src/types/Room.ts";
import { createRoomlyServer } from "./app.ts";

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

// O script de desenvolvimento passa a porta em que o proxy do Vite espera o servidor.
const port = Number(process.argv[2] ?? process.env.PORT ?? 3001);

const { httpServer } = createRoomlyServer({
  iceServers: loadIceServers(),
  staticDir: joinPath(import.meta.dirname, "..", "dist"),
});

httpServer.listen(port, () => {
  console.log(`Servidor do Roomly em http://localhost:${port}`);
});
