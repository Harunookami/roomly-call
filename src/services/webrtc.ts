import type { IceServer } from "../types/Room";

type SignalData = {
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

type Peer = {
  connection: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  settingRemoteAnswer: boolean;
  senders: Map<MediaStreamTrack, RTCRtpSender>;
  streams: Set<MediaStream>;
};

export type PeerMeshOptions = {
  selfId: string;
  iceServers: IceServer[];
  sendSignal: (to: string, data: unknown) => void;
  onStreamsChanged: (peerId: string, streams: MediaStream[]) => void;
};

// Uma conexão por participante (malha completa). A disputa de ofertas simultâneas
// é resolvida com o padrão "perfect negotiation" do WebRTC.
export class PeerMesh {
  private options: PeerMeshOptions;
  private peers = new Map<string, Peer>();
  private localTracks = new Map<MediaStreamTrack, MediaStream>();

  constructor(options: PeerMeshOptions) {
    this.options = options;
  }

  syncPeers(peerIds: string[]) {
    const wanted = new Set(peerIds);

    for (const peerId of this.peers.keys()) {
      if (!wanted.has(peerId)) {
        this.removePeer(peerId);
      }
    }

    for (const peerId of wanted) {
      this.ensurePeer(peerId);
    }
  }

  ensurePeer(peerId: string) {
    return this.peers.get(peerId) ?? this.createPeer(peerId);
  }

  removePeer(peerId: string) {
    const peer = this.peers.get(peerId);

    if (peer) {
      peer.connection.close();
      this.peers.delete(peerId);
    }
  }

  addTrack(track: MediaStreamTrack, stream: MediaStream) {
    this.localTracks.set(track, stream);

    for (const peer of this.peers.values()) {
      peer.senders.set(track, peer.connection.addTrack(track, stream));
    }
  }

  removeTrack(track: MediaStreamTrack) {
    this.localTracks.delete(track);

    for (const peer of this.peers.values()) {
      const sender = peer.senders.get(track);

      if (sender) {
        peer.connection.removeTrack(sender);
        peer.senders.delete(track);
      }
    }
  }

  // Sinais perdidos durante uma queda da sinalização deixam conexões pela metade.
  restartStalledConnections() {
    for (const { connection } of this.peers.values()) {
      if (
        connection.connectionState !== "connected" &&
        connection.getSenders().length > 0
      ) {
        connection.restartIce();
      }
    }
  }

  async handleSignal(from: string, data: unknown) {
    const { description, candidate } = data as SignalData;
    const peer = this.ensurePeer(from);
    const { connection } = peer;

    try {
      if (description) {
        const readyForOffer =
          !peer.makingOffer &&
          (connection.signalingState === "stable" || peer.settingRemoteAnswer);
        const offerCollision = description.type === "offer" && !readyForOffer;

        peer.ignoreOffer = !peer.polite && offerCollision;

        if (peer.ignoreOffer) {
          return;
        }

        peer.settingRemoteAnswer = description.type === "answer";
        await connection.setRemoteDescription(description);
        peer.settingRemoteAnswer = false;

        if (description.type === "offer") {
          await connection.setLocalDescription();
          this.sendDescription(from, connection);
        }
      } else if (candidate) {
        await connection.addIceCandidate(candidate);
      }
    } catch (error) {
      if (!peer.ignoreOffer) {
        console.error("Erro ao processar sinalização", error);
      }
    }
  }

  close() {
    for (const peerId of [...this.peers.keys()]) {
      this.removePeer(peerId);
    }

    this.localTracks.clear();
  }

  private createPeer(peerId: string) {
    const { selfId, iceServers, sendSignal } = this.options;

    const peer: Peer = {
      connection: new RTCPeerConnection({ iceServers }),
      polite: selfId < peerId,
      makingOffer: false,
      ignoreOffer: false,
      settingRemoteAnswer: false,
      senders: new Map(),
      streams: new Set(),
    };

    const { connection } = peer;

    this.peers.set(peerId, peer);

    connection.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await connection.setLocalDescription();
        this.sendDescription(peerId, connection);
      } catch (error) {
        console.error("Erro ao criar oferta", error);
      } finally {
        peer.makingOffer = false;
      }
    };

    connection.onicecandidate = ({ candidate }) => {
      if (candidate) {
        sendSignal(peerId, { candidate: candidate.toJSON() });
      }
    };

    connection.onconnectionstatechange = () => {
      if (connection.connectionState === "failed") {
        connection.restartIce();
      }
    };

    connection.ontrack = ({ streams }) => {
      for (const stream of streams) {
        peer.streams.add(stream);
        stream.onaddtrack = () => this.notifyStreams(peerId, peer);
        stream.onremovetrack = () => this.notifyStreams(peerId, peer);
      }

      this.notifyStreams(peerId, peer);
    };

    for (const [track, stream] of this.localTracks) {
      peer.senders.set(track, connection.addTrack(track, stream));
    }

    return peer;
  }

  private sendDescription(peerId: string, connection: RTCPeerConnection) {
    if (connection.localDescription) {
      this.options.sendSignal(peerId, {
        description: connection.localDescription.toJSON(),
      });
    }
  }

  private notifyStreams(peerId: string, peer: Peer) {
    if (this.peers.get(peerId) === peer) {
      this.options.onStreamsChanged(
        peerId,
        [...peer.streams].filter((stream) => stream.getTracks().length > 0)
      );
    }
  }
}
