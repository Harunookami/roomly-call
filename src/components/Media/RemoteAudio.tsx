import { useEffect, useRef } from "react";

type RemoteAudioProps = {
  stream: MediaStream;
  volume: number;
  muted: boolean;
  speakerId: string;
  onBlocked: () => void;
};

export function RemoteAudio({ stream, volume, muted, speakerId, onBlocked }: RemoteAudioProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;

    if (audio) {
      audio.srcObject = stream;
      audio.play().catch((error: unknown) => {
        // AbortError só indica que o stream foi trocado durante o play.
        if (error instanceof DOMException && error.name === "NotAllowedError") {
          onBlocked();
        }
      });
    }
  }, [stream, onBlocked]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    // Nem todo navegador permite escolher a saída de áudio.
    audioRef.current?.setSinkId?.(speakerId).catch(() => undefined);
  }, [speakerId]);

  return <audio ref={audioRef} autoPlay muted={muted} />;
}
