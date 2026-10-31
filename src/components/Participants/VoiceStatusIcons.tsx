import { HeadphoneOff, MicOff, WifiOff } from "lucide-react";

import type { Participant } from "../../types/Participant";

type VoiceStatusIconsProps = {
    participant: Participant;
}

export function VoiceStatusIcons({ participant }: VoiceStatusIconsProps) {
    return (
        <>
            {!participant.connected && (
                <span title="Reconectando">
                    <WifiOff size={16} className="text-orange-400" aria-label="Reconectando" />
                </span>
            )}

            {participant.deafened ? (
                <span title="Ensurdecido">
                    <HeadphoneOff size={16} className="text-red-300" aria-label="Ensurdecido" />
                </span>
            ) : (
                !participant.micOn && (
                    <span title="Microfone desligado">
                        <MicOff size={16} className="text-red-300" aria-label="Microfone desligado" />
                    </span>
                )
            )}
        </>
    )
}
