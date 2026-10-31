import { useEffect, useState, useSyncExternalStore } from "react";

import { RoomClient } from "../services/roomClient";

export function useRoom(name: string) {
  const [client] = useState(() => new RoomClient(name));

  useEffect(() => {
    client.start();

    return () => client.stop();
  }, [client]);

  const state = useSyncExternalStore(client.subscribe, client.getState);

  return { client, state };
}
