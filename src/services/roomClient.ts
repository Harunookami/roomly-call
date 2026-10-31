import type { MediaState, Participant } from "../types/Participant";
import type { JoinError, JoinResponse } from "../types/Room";
import { socket } from "./socket";
import { PeerMesh } from "./webrtc";

export type RoomStatus =
  | "connecting"
  | "joined"
  | "reconnecting"
  | "unavailable"
  | "kicked"
  | JoinError;

export type RoomState = {
  status: RoomStatus;
  selfId: string | null;
  participants: Participant[];
  remoteStreams: Record<string, MediaStream[]>;
  localCamera: MediaStream | null;
  localScreen: MediaStream | null;
  micOn: boolean;
  notice: string | null;
};

const initialState: RoomState = {
  status: "connecting",
  selfId: null,
  participants: [],
  remoteStreams: {},
  localCamera: null,
  localScreen: null,
  micOn: false,
  notice: null,
};

function mediaUnavailableMessage(device: string, error: unknown) {
  const name = error instanceof DOMException ? error.name : "";

  if (name === "NotAllowedError") {
    return `Permissão de ${device} negada. Libere o acesso nas configurações do navegador.`;
  }

  if (name === "NotFoundError") {
    return `Nenhum dispositivo de ${device} foi encontrado.`;
  }

  return `Não foi possível acessar: ${device}.`;
}

// Concentra o ciclo de vida da chamada fora do React: a tela só assina o estado.
export class RoomClient {
  private code: string;
  private name: string;
  private state = initialState;
  private listeners = new Set<() => void>();
  private cleanups: (() => void)[] = [];
  private session = 0;

  private mesh: PeerMesh | null = null;
  private meshOwnerId: string | null = null;
  private reconnectToken: string | undefined;
  private outgoing = new MediaStream();
  private micTrack: MediaStreamTrack | null = null;
  private cameraTrack: MediaStreamTrack | null = null;
  private screenStream: MediaStream | null = null;
  private pendingDevices = new Set<string>();

  constructor(code: string, name: string) {
    this.code = code;
    this.name = name;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = () => this.state;

  start() {
    const session = ++this.session;

    this.on("connect", () => this.join(session));
    this.on("disconnect", () => {
      if (this.state.status === "joined") {
        this.setState({ status: "reconnecting" });
      }
    });
    this.on("connect_error", () => {
      if (this.state.status === "connecting") {
        this.setState({ status: "unavailable" });
      }
    });
    this.on("participant:joined", (participant: Participant) => {
      this.setState({
        participants: [...this.state.participants, participant],
      });
      this.mesh?.ensurePeer(participant.id);
    });
    this.on("participant:updated", (participant: Participant) => {
      this.setState({
        participants: this.state.participants.map((current) =>
          current.id === participant.id ? participant : current
        ),
      });
    });
    this.on("participant:left", (participantId: string) => {
      const remoteStreams = { ...this.state.remoteStreams };

      delete remoteStreams[participantId];

      this.setState({
        participants: this.state.participants.filter(
          (participant) => participant.id !== participantId
        ),
        remoteStreams,
      });
      this.mesh?.removePeer(participantId);
    });
    this.on("signal", ({ from, data }: { from: string; data: unknown }) => {
      this.mesh?.handleSignal(from, data);
    });
    this.on("room:kicked", () => {
      this.reconnectToken = undefined;
      this.releaseMedia();
      this.setState({
        ...initialState,
        status: "kicked",
      });
    });

    const leaveOnUnload = () => {
      if (socket.connected) {
        socket.emit("room:leave");
      }
    };

    window.addEventListener("pagehide", leaveOnUnload);
    this.cleanups.push(() =>
      window.removeEventListener("pagehide", leaveOnUnload)
    );

    if (socket.connected) {
      this.join(session);
    } else {
      socket.connect();
    }
  }

  stop() {
    this.session++;
    this.cleanups.forEach((cleanup) => cleanup());
    this.cleanups = [];

    if (socket.connected) {
      socket.emit("room:leave");
    }

    this.reconnectToken = undefined;
    this.releaseMedia();
    this.state = initialState;
  }

  async toggleMic() {
    if (this.micTrack) {
      this.micTrack.enabled = !this.micTrack.enabled;
      this.setState({ micOn: this.micTrack.enabled });
      this.publishMedia();
      return;
    }

    await this.enableMic(false);
  }

  async toggleCamera() {
    if (this.cameraTrack) {
      const track = this.cameraTrack;

      this.cameraTrack = null;
      track.stop();
      this.outgoing.removeTrack(track);
      this.mesh?.removeTrack(track);
      this.setState({ localCamera: null });
      this.publishMedia();
      return;
    }

    const stream = await this.capture("camera", () =>
      navigator.mediaDevices.getUserMedia({ video: true })
    );
    const track = stream?.getVideoTracks()[0];

    if (!stream || !track) {
      return;
    }

    this.cameraTrack = track;
    this.outgoing.addTrack(track);
    this.mesh?.addTrack(track, this.outgoing);
    this.setState({ localCamera: stream });
    this.publishMedia();
  }

  async toggleScreen() {
    if (this.screenStream) {
      this.stopScreen();
      return;
    }

    const stream = await this.capture("tela", () =>
      navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
    );

    if (!stream) {
      return;
    }

    this.screenStream = stream;

    for (const track of stream.getTracks()) {
      this.mesh?.addTrack(track, stream);
    }

    // Disparado quando o usuário encerra pelo botão nativo do navegador.
    stream.getVideoTracks()[0]?.addEventListener("ended", () => {
      if (this.screenStream === stream) {
        this.stopScreen();
      }
    });

    this.setState({ localScreen: stream });
    this.publishMedia();
  }

  kick(participantId: string) {
    socket.emit("room:kick", participantId);
  }

  dismissNotice() {
    this.setState({ notice: null });
  }

  private on(event: string, listener: (...args: never[]) => void) {
    // Os nomes vêm de eventos tipados acima; aqui só guardamos para remover depois.
    const typedSocket = socket as unknown as {
      on: (event: string, listener: unknown) => void;
      off: (event: string, listener: unknown) => void;
    };

    typedSocket.on(event, listener);
    this.cleanups.push(() => typedSocket.off(event, listener));
  }

  private setState(partial: Partial<RoomState>) {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((listener) => listener());
  }

  private async join(session: number) {
    // Quem foi removido não pode voltar sozinho quando o socket reconectar.
    if (this.state.status === "kicked") {
      return;
    }

    let response: JoinResponse;

    try {
      response = await socket.timeout(8000).emitWithAck("room:join", {
        code: this.code,
        name: this.name,
        reconnectToken: this.reconnectToken,
      });
    } catch {
      if (session === this.session && socket.connected) {
        this.setState({ status: "unavailable" });
      }
      return;
    }

    if (session !== this.session) {
      return;
    }

    if (!response.ok) {
      this.releaseMedia();
      this.setState({ status: response.error });
      return;
    }

    const firstJoin = this.state.selfId === null;

    this.reconnectToken = response.reconnectToken;
    this.setupMesh(response.selfId, response.iceServers);

    const peerIds = response.participants
      .map((participant) => participant.id)
      .filter((id) => id !== response.selfId);

    this.setState({
      status: "joined",
      selfId: response.selfId,
      participants: response.participants,
      // Descarta o áudio e o vídeo de quem saiu enquanto estávamos sem conexão.
      remoteStreams: Object.fromEntries(
        Object.entries(this.state.remoteStreams).filter(([peerId]) =>
          peerIds.includes(peerId)
        )
      ),
    });

    this.mesh?.syncPeers(peerIds);

    if (firstJoin) {
      await this.enableMic(true);
    } else {
      this.publishMedia();
      this.mesh?.restartStalledConnections();
    }
  }

  private setupMesh(selfId: string, iceServers: RTCIceServer[]) {
    if (this.meshOwnerId === selfId) {
      return;
    }

    // Um novo id significa que o lugar antigo expirou: as conexões antigas não valem mais.
    this.mesh?.close();
    this.meshOwnerId = selfId;
    this.mesh = new PeerMesh({
      selfId,
      iceServers,
      sendSignal: (to, data) => socket.emit("signal", { to, data }),
      onStreamsChanged: (peerId, streams) =>
        this.setState({
          remoteStreams: { ...this.state.remoteStreams, [peerId]: streams },
        }),
    });

    for (const track of this.outgoing.getTracks()) {
      this.mesh.addTrack(track, this.outgoing);
    }

    for (const track of this.screenStream?.getTracks() ?? []) {
      this.mesh.addTrack(track, this.screenStream!);
    }
  }

  private async enableMic(automatic: boolean) {
    const stream = await this.capture(
      "microfone",
      () => navigator.mediaDevices.getUserMedia({ audio: true }),
      automatic ? "Sem acesso ao microfone: você entrou somente ouvindo." : null
    );
    const track = stream?.getAudioTracks()[0];

    if (!track) {
      return;
    }

    this.micTrack = track;
    this.outgoing.addTrack(track);
    this.mesh?.addTrack(track, this.outgoing);
    this.setState({ micOn: true });
    this.publishMedia();
  }

  // Devolve null se o acesso falhar ou se a sala tiver sido fechada durante o pedido.
  private async capture(
    device: string,
    request: () => Promise<MediaStream>,
    failureNotice: string | null = null
  ) {
    if (this.pendingDevices.has(device)) {
      return null;
    }

    const session = this.session;

    this.pendingDevices.add(device);

    try {
      if (!navigator.mediaDevices) {
        throw new Error("mediaDevices indisponível: a página precisa de HTTPS");
      }

      const stream = await request();

      if (session !== this.session) {
        stream.getTracks().forEach((track) => track.stop());
        return null;
      }

      return stream;
    } catch (error) {
      const cancelled =
        device === "tela" &&
        error instanceof DOMException &&
        error.name === "NotAllowedError";

      if (session === this.session && !cancelled) {
        this.setState({
          notice: failureNotice ?? mediaUnavailableMessage(device, error),
        });
      }

      return null;
    } finally {
      this.pendingDevices.delete(device);
    }
  }

  private stopScreen() {
    const stream = this.screenStream;

    if (!stream) {
      return;
    }

    this.screenStream = null;

    for (const track of stream.getTracks()) {
      track.stop();
      this.mesh?.removeTrack(track);
    }

    this.setState({ localScreen: null });
    this.publishMedia();
  }

  private publishMedia() {
    const media: MediaState = {
      micOn: this.micTrack?.enabled ?? false,
      cameraOn: this.cameraTrack !== null,
      screenStreamId: this.screenStream?.id ?? null,
    };

    socket.emit("media:update", media);
  }

  private releaseMedia() {
    for (const track of [
      ...this.outgoing.getTracks(),
      ...(this.screenStream?.getTracks() ?? []),
    ]) {
      track.stop();
    }

    this.mesh?.close();
    this.mesh = null;
    this.meshOwnerId = null;
    this.outgoing = new MediaStream();
    this.micTrack = null;
    this.cameraTrack = null;
    this.screenStream = null;
  }
}
