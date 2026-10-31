import { useLayoutEffect, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent, type ClipboardEvent } from "react";
import { ImagePlus, SendHorizontal, X } from "lucide-react";

import { prepareChatImage } from "../../services/chatImage";
import type { RoomClient } from "../../services/roomClient";
import { MAX_MESSAGE_LENGTH, type ChatMessage } from "../../types/Chat";
import type { Participant } from "../../types/Participant";
import { ChatMessageItem } from "./ChatMessageItem";

type ChatPanelProps = {
    client: RoomClient;
    messages: ChatMessage[];
    participants: Participant[];
    hasMore: boolean;
    typingIds: string[];
    visivel: boolean;
}

type ImagemAnexada = {
    file: File;
    previewUrl: string;
}

const AGRUPAR_ATE_MS = 5 * 60 * 1000;
const DISTANCIA_DO_FIM = 80;

const ERROS: Record<string, string> = {
    empty: "Escreva uma mensagem ou anexe uma imagem.",
    "too-long": `A mensagem passa do limite de ${MAX_MESSAGE_LENGTH} caracteres.`,
    "invalid-image": "Não foi possível usar este arquivo. Envie uma imagem PNG, JPG, WebP ou GIF.",
    "image-too-large": "A imagem é grande demais. O limite é de 1 MB depois de comprimida.",
    "image-limit": "O limite de imagens da sala foi atingido.",
    "rate-limited": "Muitas mensagens em pouco tempo. Aguarde alguns segundos.",
    "not-in-room": "Você não está mais na sala. Aguarde a reconexão.",
    unavailable: "Sem conexão com o servidor. Sua mensagem não foi enviada.",
};

function textoDigitando(nomes: string[]) {
    if (nomes.length === 0) {
        return "";
    }

    if (nomes.length === 1) {
        return `${nomes[0]} está digitando...`;
    }

    return nomes.length === 2
        ? `${nomes[0]} e ${nomes[1]} estão digitando...`
        : "Várias pessoas estão digitando...";
}

export function ChatPanel({ client, messages, participants, hasMore, typingIds, visivel }: ChatPanelProps) {
    const [texto, setTexto] = useState("");
    const [imagem, setImagem] = useState<ImagemAnexada | null>(null);
    const [resposta, setResposta] = useState<ChatMessage | null>(null);
    const [enviando, setEnviando] = useState(false);
    const [erro, setErro] = useState("");
    const [carregandoAnteriores, setCarregandoAnteriores] = useState(false);

    const listaRef = useRef<HTMLDivElement>(null);
    const campoRef = useRef<HTMLTextAreaElement>(null);
    const arquivoRef = useRef<HTMLInputElement>(null);
    const noFimRef = useRef(true);
    const alturaAntesDeCarregarRef = useRef<number | null>(null);
    const ultimaMensagemIdRef = useRef<string | undefined>(undefined);

    const rolarParaOFim = () => {
        if (listaRef.current && noFimRef.current) {
            listaRef.current.scrollTop = listaRef.current.scrollHeight;
        }
    };

    useLayoutEffect(() => {
        const lista = listaRef.current;
        const ultima = messages.at(-1);

        // Mantém na tela as mesmas mensagens quando as antigas entram por cima.
        if (lista && alturaAntesDeCarregarRef.current !== null) {
            lista.scrollTop += lista.scrollHeight - alturaAntesDeCarregarRef.current;
            alturaAntesDeCarregarRef.current = null;
            return;
        }

        if (ultima?.id !== ultimaMensagemIdRef.current && ultima?.authorName === client.name) {
            noFimRef.current = true;
        }

        ultimaMensagemIdRef.current = ultima?.id;
        rolarParaOFim();
    }, [messages, client, visivel]);

    const handleCarregarAnteriores = async () => {
        if (carregandoAnteriores) {
            return;
        }

        setCarregandoAnteriores(true);
        alturaAntesDeCarregarRef.current = listaRef.current?.scrollHeight ?? null;
        await client.loadOlderMessages();
        setCarregandoAnteriores(false);
    };

    const handleRolagem = () => {
        const lista = listaRef.current;

        if (lista) {
            noFimRef.current =
                lista.scrollHeight - lista.scrollTop - lista.clientHeight < DISTANCIA_DO_FIM;
        }
    };

    const anexar = (file: File | undefined) => {
        if (!file) {
            return;
        }

        if (!file.type.startsWith("image/")) {
            setErro(ERROS["invalid-image"]);
            return;
        }

        if (imagem) {
            URL.revokeObjectURL(imagem.previewUrl);
        }

        setErro("");
        setImagem({ file, previewUrl: URL.createObjectURL(file) });
    };

    const removerImagem = () => {
        if (imagem) {
            URL.revokeObjectURL(imagem.previewUrl);
        }

        setImagem(null);
    };

    const handleEnviar = async () => {
        if (enviando || (!texto.trim() && !imagem)) {
            return;
        }

        setEnviando(true);
        setErro("");

        let falha: string | null;

        try {
            falha = await client.sendMessage({
                text: texto,
                replyToId: resposta?.id,
                image: imagem ? await prepareChatImage(imagem.file) : undefined,
            });
        } catch (error) {
            falha = error instanceof Error ? error.message : "invalid-image";
        }

        setEnviando(false);

        // Em caso de falha, o rascunho fica no campo para a pessoa tentar de novo.
        if (falha) {
            setErro(ERROS[falha] ?? ERROS.unavailable);
            return;
        }

        setTexto("");
        setResposta(null);
        removerImagem();
        campoRef.current?.focus();
    };

    const handleTexto = (event: ChangeEvent<HTMLTextAreaElement>) => {
        setTexto(event.target.value);
        client.notifyTyping(event.target.value.trim().length > 0);
    };

    const handleTecla = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            handleEnviar();
        }

        if (event.key === "Escape") {
            setResposta(null);
        }
    };

    const handleColar = (event: ClipboardEvent<HTMLTextAreaElement>) => {
        const file = [...event.clipboardData.files].find((item) => item.type.startsWith("image/"));

        if (file) {
            event.preventDefault();
            anexar(file);
        }
    };

    const handleSoltar = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        anexar(event.dataTransfer.files[0]);
    };

    const responder = (message: ChatMessage) => {
        setResposta(message);
        campoRef.current?.focus();
    };

    const irParaMensagem = (messageId: string) => {
        document.getElementById(`mensagem-${messageId}`)?.scrollIntoView({
            behavior: "smooth",
            block: "center",
        });
    };

    const nomesDigitando = typingIds.flatMap(
        (id) => participants.find((participant) => participant.id === id)?.name ?? []
    );

    return (
        <div
            className={`min-h-0 flex-1 flex-col ${visivel ? "flex" : "hidden"}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleSoltar}
        >
            <div
                ref={listaRef}
                className="min-h-0 flex-1 overflow-y-auto pb-2"
                onScroll={handleRolagem}
                role="log"
                aria-label="Mensagens do chat"
            >
                {hasMore && (
                    <button
                        className="mx-auto mt-2 block cursor-pointer rounded-lg bg-tile px-3 py-1.5 text-xs transition-colors duration-200 hover:bg-slate-700 disabled:cursor-wait disabled:opacity-60"
                        onClick={handleCarregarAnteriores}
                        disabled={carregandoAnteriores}
                    >
                        Carregar mensagens anteriores
                    </button>
                )}

                {messages.length === 0 ? (
                    <p className="p-4 text-center text-sm text-slate-400">
                        Nenhuma mensagem ainda. Diga oi!
                    </p>
                ) : (
                    <ul>
                        {messages.map((message, index) => {
                            const anterior = messages[index - 1];

                            return (
                                <ChatMessageItem
                                    key={message.id}
                                    message={message}
                                    selfName={client.name}
                                    compacta={
                                        !message.replyTo &&
                                        anterior?.authorName === message.authorName &&
                                        message.createdAt - anterior.createdAt < AGRUPAR_ATE_MS
                                    }
                                    onReply={responder}
                                    onReact={(messageId, emoji) => client.toggleReaction(messageId, emoji)}
                                    onJumpTo={irParaMensagem}
                                    onImageLoad={rolarParaOFim}
                                />
                            );
                        })}
                    </ul>
                )}
            </div>

            <div className="shrink-0 px-2 pb-2">
                <p className="h-5 truncate px-1 text-xs text-slate-400" aria-live="polite">
                    {textoDigitando(nomesDigitando)}
                </p>

                {erro && (
                    <p className="mb-1 px-1 text-xs text-red-300" role="alert">
                        {erro}
                    </p>
                )}

                {resposta && (
                    <div className="flex items-center gap-2 rounded-t-lg bg-rail px-2 py-1 text-xs text-slate-300">
                        <span className="min-w-0 flex-1 truncate">
                            Respondendo a <strong>{resposta.authorName}</strong>
                        </span>
                        <button
                            className="cursor-pointer rounded p-0.5 hover:bg-slate-700"
                            onClick={() => setResposta(null)}
                            aria-label="Cancelar resposta"
                        >
                            <X size={14} />
                        </button>
                    </div>
                )}

                {imagem && (
                    <div className="relative w-fit bg-rail p-2">
                        <img className="max-h-24 rounded" src={imagem.previewUrl} alt="Imagem anexada" />
                        <button
                            className="absolute top-0 right-0 cursor-pointer rounded-full bg-black/80 p-0.5 hover:bg-slate-700"
                            onClick={removerImagem}
                            aria-label="Remover imagem"
                        >
                            <X size={14} />
                        </button>
                    </div>
                )}

                <div className={`flex items-end gap-1 bg-tile p-1 ${resposta || imagem ? "rounded-b-lg" : "rounded-lg"}`}>
                    <button
                        className="shrink-0 cursor-pointer rounded p-2 text-slate-300 hover:bg-slate-700 hover:text-white"
                        onClick={() => arquivoRef.current?.click()}
                        aria-label="Anexar imagem"
                        title="Anexar imagem"
                    >
                        <ImagePlus size={18} />
                    </button>

                    <input
                        ref={arquivoRef}
                        type="file"
                        className="hidden"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        aria-label="Arquivo de imagem"
                        onChange={(event) => {
                            anexar(event.target.files?.[0]);
                            event.target.value = "";
                        }}
                    />

                    <textarea
                        ref={campoRef}
                        className="field-sizing-content max-h-32 min-w-0 flex-1 resize-none bg-transparent px-1 py-1.5 text-sm outline-none placeholder:text-slate-400"
                        rows={1}
                        placeholder="Enviar mensagem"
                        aria-label="Mensagem"
                        maxLength={MAX_MESSAGE_LENGTH}
                        value={texto}
                        onChange={handleTexto}
                        onKeyDown={handleTecla}
                        onPaste={handleColar}
                    />

                    <button
                        className="shrink-0 cursor-pointer rounded p-2 text-blue-400 hover:bg-slate-700 disabled:cursor-not-allowed disabled:text-slate-500"
                        onClick={handleEnviar}
                        disabled={enviando || (!texto.trim() && !imagem)}
                        aria-label="Enviar mensagem"
                        title="Enviar mensagem"
                    >
                        <SendHorizontal size={18} />
                    </button>
                </div>
            </div>
        </div>
    )
}
