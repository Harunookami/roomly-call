type SinkAudioContext = AudioContext & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

let context: SinkAudioContext | null = null;

export function getAudioContext() {
  if (!context) {
    const created: SinkAudioContext = new AudioContext();

    context = created;

    // O navegador só libera o áudio depois de uma interação com a página.
    const resume = () => {
      created.resume().catch(() => undefined);
    };

    resume();
    document.addEventListener("pointerdown", resume);
    document.addEventListener("keydown", resume);
  }

  return context;
}

export function setOutputDevice(deviceId: string) {
  getAudioContext()
    .setSinkId?.(deviceId)
    .catch(() => undefined);
}
