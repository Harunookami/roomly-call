import type { Participant as ParticipantData } from "../../types/Participant";
import { Participant } from "./Participant";

type ParticipantListProps = {
    participants: ParticipantData[];
    selfId: string | null;
    speakingIds: string[];
    volumes: Record<string, number>;
    onVolumeChange: (participantId: string, volume: number) => void;
    onKick: (participantId: string) => void;
}

export function ParticipantList({ participants, selfId, speakingIds, volumes, onVolumeChange, onKick }: ParticipantListProps) {
    const souAnfitriao = participants.some(
        (participant) => participant.id === selfId && participant.isHost
    );

    return (
        <>
            <h2 className="mb-2 px-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                Participantes ({participants.length})
            </h2>

            <ul className="flex flex-col gap-1">
                {participants.map((participant) => (
                    <Participant
                        key={participant.id}
                        participant={participant}
                        isSelf={participant.id === selfId}
                        speaking={speakingIds.includes(participant.id)}
                        volume={volumes[participant.id] ?? 1}
                        onVolumeChange={(volume) => onVolumeChange(participant.id, volume)}
                        onKick={souAnfitriao ? () => onKick(participant.id) : undefined}
                    />
                ))}
            </ul>
        </>
    )
}
