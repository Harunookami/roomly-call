import { useState } from "react";
import { Crown } from "lucide-react";

import type { Participant as ParticipantData } from "../../types/Participant";
import { Avatar } from "./Avatar";
import { VoiceStatusIcons } from "./VoiceStatusIcons";

type ParticipantProps = {
    participant: ParticipantData;
    isSelf: boolean;
    speaking: boolean;
    volume: number;
    onVolumeChange: (volume: number) => void;
    onKick?: () => void;
}

export function Participant({ participant, isSelf, speaking, volume, onVolumeChange, onKick }: ParticipantProps) {
    const [aberto, setAberto] = useState(false);

    const conteudo = (
        <>
            <Avatar name={participant.name} speaking={speaking} />

            <span className="min-w-0 flex-1 truncate text-sm">
                {participant.name}
                {isSelf && <span className="text-slate-400"> (você)</span>}
            </span>

            {participant.isHost && (
                <span title="Anfitrião">
                    <Crown size={16} className="text-yellow-400" aria-label="Anfitrião" />
                </span>
            )}

            <VoiceStatusIcons participant={participant} />
        </>
    );

    if (isSelf) {
        return <li className="flex items-center gap-2 rounded-lg p-2">{conteudo}</li>;
    }

    return (
        <li className="rounded-lg transition-colors duration-200 hover:bg-tile/60">
            <button
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg p-2 text-left"
                onClick={() => setAberto(!aberto)}
                aria-expanded={aberto}
                aria-label={`Opções de ${participant.name}`}
            >
                {conteudo}
            </button>

            {aberto && (
                <div className="flex flex-col gap-2 px-2 pb-2">
                    <label className="flex flex-col gap-1 text-xs text-slate-300">
                        Volume: {Math.round(volume * 100)}%
                        <input
                            type="range"
                            className="accent-blue-500"
                            min={0}
                            max={1}
                            step={0.05}
                            value={volume}
                            onChange={(event) => onVolumeChange(Number(event.target.value))}
                            aria-label={`Volume de ${participant.name}`}
                        />
                    </label>

                    {onKick && (
                        <button
                            className="cursor-pointer rounded bg-red-500/20 px-2 py-1 text-xs text-red-300 transition-colors duration-300 hover:bg-red-500/30"
                            onClick={onKick}
                        >
                            Remover {participant.name}
                        </button>
                    )}
                </div>
            )}
        </li>
    )
}
