import { Crown, MicOff, UserX, WifiOff } from "lucide-react";

import type { Participant as ParticipantData } from "../../types/Participant";
import { StreamVideo } from "../Media/StreamVideo";

type ParticipantProps = {
    participant: ParticipantData;
    isSelf: boolean;
    cameraStream: MediaStream | null;
    onKick?: () => void;
}

export function Participant({ participant, isSelf, cameraStream, onKick }: ParticipantProps) {
    return (
        <li className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
            {cameraStream && (
                <StreamVideo
                    stream={cameraStream}
                    className={`aspect-video w-full bg-black object-cover ${isSelf ? "-scale-x-100" : ""}`}
                />
            )}

            <div className="flex items-center gap-2 p-2">
                {!cameraStream && (
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-500 text-sm font-bold uppercase">
                        {participant.name.charAt(0)}
                    </span>
                )}

                <span className="min-w-0 flex-1 truncate text-sm">
                    {participant.name}
                    {isSelf && <span className="text-slate-400"> (você)</span>}
                </span>

                {participant.isHost && (
                    <span title="Anfitrião">
                        <Crown size={16} className="text-yellow-400" aria-label="Anfitrião" />
                    </span>
                )}

                {!participant.connected && (
                    <span title="Reconectando">
                        <WifiOff size={16} className="text-orange-400" aria-label="Reconectando" />
                    </span>
                )}

                {!participant.micOn && (
                    <span title="Microfone desligado">
                        <MicOff size={16} className="text-slate-400" aria-label="Microfone desligado" />
                    </span>
                )}

                {onKick && (
                    <button
                        className="cursor-pointer rounded p-1 text-slate-400 transition-colors duration-300 hover:bg-slate-800 hover:text-red-400"
                        onClick={onKick}
                        title={`Remover ${participant.name}`}
                        aria-label={`Remover ${participant.name}`}
                    >
                        <UserX size={16} />
                    </button>
                )}
            </div>
        </li>
    )
}
