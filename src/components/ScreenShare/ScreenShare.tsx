import { useRef, useState } from "react";
import { Maximize } from "lucide-react";

import { StreamVideo } from "../Media/StreamVideo";

export type SharedScreen = {
    participantId: string;
    label: string;
    stream: MediaStream;
}

type ScreenShareProps = {
    screens: SharedScreen[];
}

export function ScreenShare({ screens }: ScreenShareProps) {
    const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
    const palcoRef = useRef<HTMLDivElement>(null);

    const ativa =
        screens.find((screen) => screen.participantId === selecionadaId) ??
        screens[0];

    return (
        <div className="flex min-h-64 flex-1 flex-col gap-2">
            {screens.length > 1 && (
                <div className="flex flex-wrap gap-2">
                    {screens.map((screen) => (
                        <button
                            key={screen.participantId}
                            className={`cursor-pointer rounded-lg px-3 py-1 text-sm transition-colors duration-300 ${
                                screen === ativa
                                    ? "bg-blue-500"
                                    : "bg-tile hover:bg-slate-700"
                            }`}
                            onClick={() => setSelecionadaId(screen.participantId)}
                        >
                            {screen.label}
                        </button>
                    ))}
                </div>
            )}

            <div
                ref={palcoRef}
                data-stage
                className="relative min-h-0 flex-1 overflow-hidden rounded-lg bg-black"
            >
                <StreamVideo
                    stream={ativa.stream}
                    className="absolute inset-0 h-full w-full object-contain"
                />
                <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 text-sm">
                    {ativa.label}
                </span>
                <button
                    className="absolute right-2 bottom-2 cursor-pointer rounded bg-black/70 p-2 hover:bg-slate-800"
                    onClick={() => palcoRef.current?.requestFullscreen()}
                    title="Tela cheia"
                    aria-label="Tela cheia"
                >
                    <Maximize size={16} />
                </button>
            </div>
        </div>
    )
}
