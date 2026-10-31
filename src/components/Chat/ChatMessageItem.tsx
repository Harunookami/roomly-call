import { useState } from "react";
import { CornerUpLeft, Reply, SmilePlus } from "lucide-react";

import { REACTION_EMOJIS, type ChatMessage } from "../../types/Chat";
import { Avatar } from "../Participants/Avatar";
import { MessageText } from "./MessageText";

type ChatMessageItemProps = {
    message: ChatMessage;
    selfName: string;
    // Mensagem seguida do mesmo autor: não repete avatar e nome.
    compacta: boolean;
    onReply: (message: ChatMessage) => void;
    onReact: (messageId: string, emoji: string) => void;
    onJumpTo: (messageId: string) => void;
    onImageLoad: () => void;
}

const CLASSE_ACAO = "cursor-pointer rounded p-1 text-slate-300 hover:bg-slate-700 hover:text-white";

function formatarHora(timestamp: number) {
    return new Date(timestamp).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function ChatMessageItem({ message, selfName, compacta, onReply, onReact, onJumpTo, onImageLoad }: ChatMessageItemProps) {
    const [escolhendoEmoji, setEscolhendoEmoji] = useState(false);

    const reacoes = REACTION_EMOJIS.filter((emoji) => message.reactions[emoji]);

    return (
        <li
            id={`mensagem-${message.id}`}
            data-message={message.text}
            className={`group relative flex gap-2 rounded px-2 py-0.5 hover:bg-tile/40 ${compacta ? "" : "mt-3"}`}
        >
            {!compacta && <Avatar name={message.authorName} />}

            <div className={`min-w-0 flex-1 ${compacta ? "pl-10" : ""}`}>
                {message.replyTo && (
                    <button
                        className="mb-0.5 flex max-w-full cursor-pointer items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
                        onClick={() => onJumpTo(message.replyTo!.id)}
                    >
                        <CornerUpLeft size={12} className="shrink-0" />
                        <span className="shrink-0 font-semibold">{message.replyTo.authorName}</span>
                        <span className="truncate">{message.replyTo.text || "Imagem"}</span>
                    </button>
                )}

                {!compacta && (
                    <p className="flex items-baseline gap-2">
                        <span className="truncate text-sm font-semibold">{message.authorName}</span>
                        <time className="shrink-0 text-xs text-slate-400">{formatarHora(message.createdAt)}</time>
                    </p>
                )}

                {message.text && <MessageText text={message.text} />}

                {message.imageUrl && (
                    <a href={message.imageUrl} target="_blank" rel="noopener noreferrer">
                        <img
                            className="mt-1 max-h-64 max-w-full rounded-lg"
                            src={message.imageUrl}
                            alt={`Imagem enviada por ${message.authorName}`}
                            onLoad={onImageLoad}
                        />
                    </a>
                )}

                {reacoes.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                        {reacoes.map((emoji) => {
                            const quem = message.reactions[emoji];
                            const minha = quem.includes(selfName);

                            return (
                                <button
                                    key={emoji}
                                    className={`flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
                                        minha
                                            ? "border-blue-400 bg-blue-500/20"
                                            : "border-transparent bg-tile hover:border-slate-500"
                                    }`}
                                    onClick={() => onReact(message.id, emoji)}
                                    aria-pressed={minha}
                                    aria-label={`Reação ${emoji}: ${quem.length}`}
                                >
                                    <span>{emoji}</span>
                                    <span>{quem.length}</span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            <div
                className={`absolute -top-3 right-1 z-10 flex items-center rounded-lg bg-rail shadow group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100 ${
                    escolhendoEmoji ? "opacity-100" : "opacity-0"
                }`}
            >
                {escolhendoEmoji &&
                    REACTION_EMOJIS.map((emoji) => (
                        <button
                            key={emoji}
                            className="cursor-pointer rounded p-1 text-sm hover:bg-slate-700"
                            onClick={() => {
                                onReact(message.id, emoji);
                                setEscolhendoEmoji(false);
                            }}
                            aria-label={`Reagir com ${emoji}`}
                        >
                            {emoji}
                        </button>
                    ))}

                <button
                    className={CLASSE_ACAO}
                    onClick={() => setEscolhendoEmoji(!escolhendoEmoji)}
                    aria-expanded={escolhendoEmoji}
                    aria-label="Adicionar reação"
                    title="Adicionar reação"
                >
                    <SmilePlus size={16} />
                </button>

                <button
                    className={CLASSE_ACAO}
                    onClick={() => onReply(message)}
                    aria-label="Responder"
                    title="Responder"
                >
                    <Reply size={16} />
                </button>
            </div>
        </li>
    )
}
