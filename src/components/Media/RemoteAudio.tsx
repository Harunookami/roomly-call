import { useEffect, useRef } from "react";

type RemoteAudioProps = {
  stream: MediaStream;
  onBlocked: () => void;
};

export function RemoteAudio({ stream, onBlocked }: RemoteAudioProps) {
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

  return <audio ref={audioRef} autoPlay />;
}
