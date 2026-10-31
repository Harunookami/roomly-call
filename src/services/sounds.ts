import { getAudioContext } from "./audioContext";

export type SoundName =
  | "join"
  | "leave"
  | "mute"
  | "unmute"
  | "deafen"
  | "undeafen"
  | "message";

const NOTE_SECONDS = 0.09;
const VOLUME = 0.08;

// Sons gerados na hora, para não depender de arquivos de áudio.
const NOTES: Record<SoundName, number[]> = {
  join: [523, 784],
  leave: [784, 523],
  mute: [392],
  unmute: [587],
  deafen: [392, 294],
  undeafen: [294, 392],
  message: [880, 660],
};

export function playSound(name: SoundName) {
  const context = getAudioContext();

  NOTES[name].forEach((frequency, index) => {
    const start = context.currentTime + index * NOTE_SECONDS;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(VOLUME, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + NOTE_SECONDS);

    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + NOTE_SECONDS);
  });
}
