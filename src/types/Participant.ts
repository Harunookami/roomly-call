export type MediaState = {
  micOn: boolean;
  deafened: boolean;
  cameraOn: boolean;
  screenStreamId: string | null;
};

export type Participant = MediaState & {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
};
