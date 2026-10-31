import type { Participant as ParticipantData } from "../../types/Participant";
import { Participant } from "./Participant";

type ParticipantListProps = {
    participants: ParticipantData[];
    selfId: string | null;
    getCameraStream: (participant: ParticipantData) => MediaStream | null;
    onKick: (participantId: string) => void;
}

export function ParticipantList({ participants, selfId, getCameraStream, onKick }: ParticipantListProps) {
    const souAnfitriao = participants.some(
        (participant) => participant.id === selfId && participant.isHost
    );

    return (
        <>
            <h2 className="mb-3 text-sm font-semibold text-slate-300">
                Participantes ({participants.length})
            </h2>

            <ul className="flex flex-col gap-2">
                {participants.map((participant) => (
                    <Participant
                        key={participant.id}
                        participant={participant}
                        isSelf={participant.id === selfId}
                        cameraStream={getCameraStream(participant)}
                        onKick={
                            souAnfitriao && participant.id !== selfId
                                ? () => onKick(participant.id)
                                : undefined
                        }
                    />
                ))}
            </ul>
        </>
    )
}
