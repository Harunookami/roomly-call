import type { Participant } from "../../types/Participant";
import { StreamVideo } from "../Media/StreamVideo";
import { Avatar } from "../Participants/Avatar";
import { VoiceStatusIcons } from "../Participants/VoiceStatusIcons";

type VoiceTileProps = {
    participant: Participant;
    isSelf: boolean;
    speaking: boolean;
    cameraStream: MediaStream | null;
    className?: string;
}

export function VoiceTile({ participant, isSelf, speaking, cameraStream, className = "" }: VoiceTileProps) {
    return (
        <div
            data-tile={participant.name}
            data-speaking={speaking}
            className={`relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-tile outline-2 -outline-offset-2 transition-colors duration-100 ${
                speaking ? "outline-speaking" : "outline-transparent"
            } ${className}`}
        >
            {cameraStream ? (
                <StreamVideo
                    stream={cameraStream}
                    className={`absolute inset-0 h-full w-full object-cover ${isSelf ? "-scale-x-100" : ""}`}
                />
            ) : (
                <Avatar name={participant.name} className="size-12 text-lg sm:size-16 sm:text-2xl" />
            )}

            <span className="absolute bottom-1.5 left-1.5 flex max-w-[calc(100%-0.75rem)] items-center gap-1.5 rounded bg-black/70 px-2 py-0.5 text-xs">
                <span className="truncate">{participant.name}</span>
                <VoiceStatusIcons participant={participant} />
            </span>
        </div>
    )
}
