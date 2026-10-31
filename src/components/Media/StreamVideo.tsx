import { useEffect, useRef } from "react";

type StreamVideoProps = {
  stream: MediaStream;
  className?: string;
};

// Sempre sem som: o áudio remoto toca em RemoteAudio, mesmo com o vídeo fora da tela.
export function StreamVideo({ stream, className }: StreamVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      className={className}
      autoPlay
      playsInline
      muted
    />
  );
}
