import type { Participant } from "../../types/Participant";
import { ScreenShare, type SharedScreen } from "../ScreenShare/ScreenShare";
import { VoiceTile } from "./VoiceTile";

type CallStageProps = {
    participants: Participant[];
    selfId: string | null;
    speakingIds: string[];
    screens: SharedScreen[];
    getCameraStream: (participant: Participant) => MediaStream | null;
}

function colunasDaGrade(total: number) {
    if (total <= 1) {
        return "grid-cols-1 max-w-3xl";
    }

    return total <= 4 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3";
}

export function CallStage({ participants, selfId, speakingIds, screens, getCameraStream }: CallStageProps) {
    const tiles = (className?: string) =>
        participants.map((participant) => (
            <VoiceTile
                key={participant.id}
                participant={participant}
                isSelf={participant.id === selfId}
                speaking={speakingIds.includes(participant.id)}
                cameraStream={getCameraStream(participant)}
                className={className}
            />
        ));

    if (screens.length > 0) {
        return (
            <div className="flex min-h-0 flex-1 flex-col gap-2">
                <ScreenShare screens={screens} />
                <div className="flex shrink-0 gap-2 overflow-x-auto pb-1">
                    {tiles("h-24 shrink-0")}
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto">
            <div className={`grid w-full max-w-5xl gap-2 ${colunasDaGrade(participants.length)}`}>
                {tiles()}
            </div>
        </div>
    )
}
