import { Volume2 } from "lucide-react";

import type { Participant } from "../../types/Participant";
import { Avatar } from "../Participants/Avatar";
import { VoiceStatusIcons } from "../Participants/VoiceStatusIcons";

type ChannelSidebarProps = {
    codigoSala: string;
    participants: Participant[];
    selfId: string | null;
    speakingIds: string[];
    reconectando: boolean;
}

export function ChannelSidebar({ codigoSala, participants, selfId, speakingIds, reconectando }: ChannelSidebarProps) {
    const eu = participants.find((participant) => participant.id === selfId);

    return (
        <aside className="hidden w-56 shrink-0 flex-col bg-sidebar lg:flex">
            <h1 className="flex h-14 shrink-0 items-center border-b border-black/30 px-4 font-bold tracking-tight">
                Roomly
            </h1>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
                <h2 className="mb-1 px-2 pt-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                    Canal de voz
                </h2>

                <p className="flex items-center gap-2 rounded-lg bg-tile px-2 py-1.5 text-sm font-medium">
                    <Volume2 size={16} className="shrink-0 text-slate-400" />
                    <span className="truncate">Sala {codigoSala}</span>
                </p>

                <ul className="mt-1 ml-4 flex flex-col gap-1">
                    {participants.map((participant) => (
                        <li key={participant.id} className="flex items-center gap-2 px-2 py-1 text-sm text-slate-300">
                            <Avatar
                                name={participant.name}
                                speaking={speakingIds.includes(participant.id)}
                                className="size-6 text-xs"
                            />
                            <span className="min-w-0 flex-1 truncate">{participant.name}</span>
                            <VoiceStatusIcons participant={participant} />
                        </li>
                    ))}
                </ul>
            </div>

            {eu && (
                <div className="flex items-center gap-2 bg-rail/60 p-2">
                    <Avatar name={eu.name} speaking={speakingIds.includes(eu.id)} />
                    <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{eu.name}</p>
                        <p className={`text-xs ${reconectando ? "text-orange-300" : "text-speaking"}`}>
                            {reconectando ? "Reconectando..." : "Voz conectada"}
                        </p>
                    </div>
                </div>
            )}
        </aside>
    )
}
