import { getAudioContext } from "./audioContext";

const CHECK_INTERVAL_MS = 100;
const SPEAKING_THRESHOLD = 0.02;
// Mantém o indicador aceso nas pausas curtas entre as palavras.
const HOLD_MS = 400;

type Monitor = {
  track: MediaStreamTrack;
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  samples: Float32Array<ArrayBuffer>;
  lastLoudAt: number;
};

export class SpeakingDetector {
  private onChange: (speakingIds: string[]) => void;
  private monitors = new Map<string, Monitor>();
  private speaking: string[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(onChange: (speakingIds: string[]) => void) {
    this.onChange = onChange;
  }

  // Recebe a faixa de áudio atual de cada participante.
  sync(tracks: Map<string, MediaStreamTrack>) {
    for (const [id, monitor] of this.monitors) {
      if (tracks.get(id) !== monitor.track) {
        monitor.source.disconnect();
        this.monitors.delete(id);
      }
    }

    for (const [id, track] of tracks) {
      if (!this.monitors.has(id)) {
        this.monitors.set(id, this.createMonitor(track));
      }
    }

    if (this.monitors.size > 0 && !this.timer) {
      this.timer = setInterval(() => this.check(), CHECK_INTERVAL_MS);
    }
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.sync(new Map());
    this.speaking = [];
  }

  private createMonitor(track: MediaStreamTrack): Monitor {
    const context = getAudioContext();
    const source = context.createMediaStreamSource(new MediaStream([track]));
    const analyser = context.createAnalyser();

    analyser.fftSize = 1024;
    source.connect(analyser);

    return {
      track,
      source,
      analyser,
      samples: new Float32Array(analyser.fftSize),
      lastLoudAt: 0,
    };
  }

  private check() {
    const now = performance.now();
    const speaking: string[] = [];

    for (const [id, monitor] of this.monitors) {
      monitor.analyser.getFloatTimeDomainData(monitor.samples);

      const energy = monitor.samples.reduce(
        (total, sample) => total + sample * sample,
        0
      );

      if (Math.sqrt(energy / monitor.samples.length) > SPEAKING_THRESHOLD) {
        monitor.lastLoudAt = now;
      }

      if (monitor.lastLoudAt > 0 && now - monitor.lastLoudAt < HOLD_MS) {
        speaking.push(id);
      }
    }

    const changed =
      speaking.length !== this.speaking.length ||
      speaking.some((id) => !this.speaking.includes(id));

    if (changed) {
      this.speaking = speaking;
      this.onChange(speaking);
    }
  }
}
