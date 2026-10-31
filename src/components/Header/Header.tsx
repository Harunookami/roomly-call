import { useState } from "react";
import { Check, Copy } from "lucide-react";

type HeaderProps = {
    codigoSala: string;
}

export function Header({ codigoSala }: HeaderProps) {
    const [copiado, setCopiado] = useState(false);

    const handleCopiarLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
        } catch {
            setCopiado(false);
        }
    };

    return (
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-800 px-4">
            <h1 className="text-xl font-bold tracking-tight">Roomly</h1>

            <button
                className="flex min-w-0 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors duration-300 hover:bg-slate-800"
                onClick={handleCopiarLink}
                title="Copiar link da sala"
            >
                <span className="truncate">Sala {codigoSala}</span>
                {copiado ? (
                    <Check size={16} className="shrink-0 text-green-400" />
                ) : (
                    <Copy size={16} className="shrink-0" />
                )}
                <span className="sr-only" aria-live="polite">
                    {copiado ? "Link copiado" : ""}
                </span>
            </button>
        </header>
    )
}
