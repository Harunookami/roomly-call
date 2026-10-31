import type { MediaState, Participant } from "../types/Participant";
import type { JoinError, JoinResponse } from "../types/Room";
import { setOutputDevice } from "./audioContext";
import {
  loadPreferences,
  savePreferences,
  type Preferences,
  type ScreenFps,
  type ScreenResolution,
} from "./preferences";
import { socket } from "./socket";
import { playSound, type SoundName } from "./sounds";
import { SpeakingDetector } from "./speaking";
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
  deafened: boolean;
  pushToTalkPressed: boolean;
  speakingIds: string[];
  volumes: Record<string, number>;
  preferences: Preferences;
  notice: string | null;
};

function createInitialState(): RoomState {
  return {
    status: "connecting",
    selfId: null,
    participants: [],
    remoteStreams: {},
    localCamera: null,
    localScreen: null,
    micOn: false,
    deafened: false,
    pushToTalkPressed: false,
    speakingIds: [],
    volumes: {},
    preferences: loadPreferences(),
    notice: null,
  };
}

// Solta o botão com um pequeno atraso para não cortar o fim da fala.
const PUSH_TO_TALK_RELEASE_MS = 150;

const SCREEN_BITRATE: Record<ScreenResolution, number> = {
  720: 2_500_000,
  1080: 4_500_000,
};

const SCREEN_FPS_FACTOR: Record<ScreenFps, number> = {
  15: 0.6,
  30: 1,
  60: 1.5,
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

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

function microphoneConstraints(deviceId: string): MediaStreamConstraints {
  return {
    audio: {
      deviceId: deviceId ? { ideal: deviceId } : undefined,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  };
}

function cameraConstraints(deviceId: string): MediaStreamConstraints {
  return { video: deviceId ? { deviceId: { ideal: deviceId } } : true };
}

// Concentra o ciclo de vida da chamada fora do React: a tela só assina o estado.
export class RoomClient {
  private code: string;
  private name: string;
  private state = createInitialState();
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
  private micOnBeforeDeafen = false;
  private pushToTalkRelease: ReturnType<typeof setTimeout> | undefined;
  private speaking = new SpeakingDetector((speakingIds) =>
    this.setState({ speakingIds })
  );

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
      this.playCallSound("join");
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
      this.playCallSound("leave");
    });
    this.on("signal", ({ from, data }: { from: string; data: unknown }) => {
      this.mesh?.handleSignal(from, data);
    });
    this.on("room:kicked", () => {
      this.reconnectToken = undefined;
      this.releaseMedia();
      this.state = createInitialState();
      this.setState({ status: "kicked" });
    });

    const leaveOnUnload = () => {
      if (socket.connected) {
        socket.emit("room:leave");
      }
    };

    this.listen(window, "pagehide", leaveOnUnload);
    this.listen(document, "keydown", (event) =>
      this.handlePushToTalkDown(event as KeyboardEvent)
    );
    this.listen(document, "keyup", (event) =>
      this.handlePushToTalkUp(event as KeyboardEvent)
    );
    this.listen(window, "blur", () => this.releasePushToTalk());

    if (this.state.preferences.speakerId) {
      setOutputDevice(this.state.preferences.speakerId);
    }

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
    this.state = createInitialState();
  }

  async toggleMic() {
    if (this.state.deafened) {
      this.toggleDeafen();

      if (this.state.micOn) {
        return;
      }
    }

    if (!this.micTrack) {
      await this.enableMic(false);
      return;
    }

    const micOn = !this.state.micOn;

    this.setState({ micOn });
    this.applyMicState();
    this.playPreferredSound(micOn ? "unmute" : "mute");
    this.publishMedia();
  }

  toggleDeafen() {
    const deafened = !this.state.deafened;

    if (deafened) {
      this.micOnBeforeDeafen = this.state.micOn;
    }

    this.setState({
      deafened,
      micOn: deafened ? false : this.micOnBeforeDeafen,
    });
    this.applyMicState();
    this.playPreferredSound(deafened ? "deafen" : "undeafen");
    this.publishMedia();
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
      navigator.mediaDevices.getUserMedia(
        cameraConstraints(this.state.preferences.cameraId)
      )
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

  async startScreen() {
    if (this.screenStream) {
      return;
    }

    const { screenResolution, screenFps } = this.state.preferences;
    const maxBitrate = SCREEN_BITRATE[screenResolution] * SCREEN_FPS_FACTOR[screenFps];

    const stream = await this.capture("tela", () =>
      navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { max: Math.round((screenResolution * 16) / 9) },
          height: { max: screenResolution },
          frameRate: { max: screenFps },
        },
        audio: true,
      })
    );

    if (!stream) {
      return;
    }

    this.screenStream = stream;

    const videoTrack = stream.getVideoTracks()[0];

    if (videoTrack) {
      // Em até 30 fps prioriza a nitidez do texto; em 60 fps, a fluidez.
      videoTrack.contentHint = screenFps === 60 ? "motion" : "detail";

      // Disparado quando o usuário encerra pelo botão nativo do navegador.
      videoTrack.addEventListener("ended", () => {
        if (this.screenStream === stream) {
          this.stopScreen();
        }
      });
    }

    for (const track of stream.getTracks()) {
      this.mesh?.addTrack(
        track,
        stream,
        track === videoTrack ? maxBitrate : undefined
      );
    }

    this.setState({ localScreen: stream });
    this.publishMedia();
  }

  stopScreen() {
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

  updatePreferences(changes: Partial<Preferences>) {
    const preferences = { ...this.state.preferences, ...changes };

    savePreferences(preferences);
    this.setState({ preferences });
    this.applyMicState();
  }

  async setMicDevice(micId: string) {
    this.updatePreferences({ micId });

    if (!this.micTrack) {
      return;
    }

    const stream = await this.capture("microfone", () =>
      navigator.mediaDevices.getUserMedia(microphoneConstraints(micId))
    );
    const track = stream?.getAudioTracks()[0];
    const previous = this.micTrack;

    if (!track || !previous) {
      return;
    }

    this.micTrack = track;
    this.outgoing.removeTrack(previous);
    this.outgoing.addTrack(track);
    this.mesh?.replaceTrack(previous, track);
    previous.stop();
    this.applyMicState();
    this.syncSpeaking();
  }

  async setCameraDevice(cameraId: string) {
    this.updatePreferences({ cameraId });

    if (!this.cameraTrack) {
      return;
    }

    const stream = await this.capture("camera", () =>
      navigator.mediaDevices.getUserMedia(cameraConstraints(cameraId))
    );
    const track = stream?.getVideoTracks()[0];
    const previous = this.cameraTrack;

    if (!stream || !track || !previous) {
      return;
    }

    this.cameraTrack = track;
    this.outgoing.removeTrack(previous);
    this.outgoing.addTrack(track);
    this.mesh?.replaceTrack(previous, track);
    previous.stop();
    this.setState({ localCamera: stream });
  }

  setSpeakerDevice(speakerId: string) {
    this.updatePreferences({ speakerId });
    setOutputDevice(speakerId);
  }

  setVolume(participantId: string, volume: number) {
    this.setState({
      volumes: { ...this.state.volumes, [participantId]: volume },
    });
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

  private listen(
    target: EventTarget,
    event: string,
    listener: (event: Event) => void
  ) {
    target.addEventListener(event, listener);
    this.cleanups.push(() => target.removeEventListener(event, listener));
  }

  private setState(partial: Partial<RoomState>) {
    this.state = { ...this.state, ...partial };

    if (partial.participants || partial.remoteStreams) {
      this.syncSpeaking();
    }

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
      this.playPreferredSound("join");
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
      () =>
        navigator.mediaDevices.getUserMedia(
          microphoneConstraints(this.state.preferences.micId)
        ),
      automatic ? "Sem acesso ao microfone: você entrou somente ouvindo." : null
    );
    const track = stream?.getAudioTracks()[0];

    if (!track) {
      return;
    }

    this.micTrack = track;
    this.setState({ micOn: !this.state.deafened });
    this.micOnBeforeDeafen = true;
    this.applyMicState();
    this.outgoing.addTrack(track);
    this.mesh?.addTrack(track, this.outgoing);
    this.syncSpeaking();
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

  private applyMicState() {
    if (this.micTrack) {
      const { micOn, preferences, pushToTalkPressed } = this.state;

      this.micTrack.enabled =
        micOn && (!preferences.pushToTalk || pushToTalkPressed);
    }
  }

  private handlePushToTalkDown(event: KeyboardEvent) {
    const { pushToTalk, pushToTalkKey } = this.state.preferences;

    if (!pushToTalk || event.code !== pushToTalkKey || isTyping(event.target)) {
      return;
    }

    event.preventDefault();
    clearTimeout(this.pushToTalkRelease);

    if (!this.state.pushToTalkPressed) {
      this.setState({ pushToTalkPressed: true });
      this.applyMicState();
    }
  }

  private handlePushToTalkUp(event: KeyboardEvent) {
    if (event.code === this.state.preferences.pushToTalkKey) {
      clearTimeout(this.pushToTalkRelease);
      this.pushToTalkRelease = setTimeout(
        () => this.releasePushToTalk(),
        PUSH_TO_TALK_RELEASE_MS
      );
    }
  }

  private releasePushToTalk() {
    clearTimeout(this.pushToTalkRelease);

    if (this.state.pushToTalkPressed) {
      this.setState({ pushToTalkPressed: false });
      this.applyMicState();
    }
  }

  private syncSpeaking() {
    const tracks = new Map<string, MediaStreamTrack>();
    const { selfId, participants, remoteStreams } = this.state;

    if (selfId && this.micTrack) {
      tracks.set(selfId, this.micTrack);
    }

    for (const participant of participants) {
      // O áudio da tela compartilhada não conta como fala.
      const voice = remoteStreams[participant.id]
        ?.filter((stream) => stream.id !== participant.screenStreamId)
        .flatMap((stream) => stream.getAudioTracks())[0];

      if (voice) {
        tracks.set(participant.id, voice);
      }
    }

    this.speaking.sync(tracks);
  }

  private playPreferredSound(name: SoundName) {
    if (this.state.preferences.soundsEnabled) {
      playSound(name);
    }
  }

  // Avisos da sala ficam em silêncio para quem ensurdeceu.
  private playCallSound(name: SoundName) {
    if (!this.state.deafened) {
      this.playPreferredSound(name);
    }
  }

  private publishMedia() {
    const media: MediaState = {
      micOn: this.micTrack !== null && this.state.micOn,
      deafened: this.state.deafened,
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

    clearTimeout(this.pushToTalkRelease);
    this.speaking.stop();
    this.mesh?.close();
    this.mesh = null;
    this.meshOwnerId = null;
    this.outgoing = new MediaStream();
    this.micTrack = null;
    this.cameraTrack = null;
    this.screenStream = null;
  }
}
