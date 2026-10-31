import { useState } from "react";
import { Check, Copy, Volume2 } from "lucide-react";

import { ROOM_NAME } from "../../types/Room";

export function Header() {
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
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-black/30 px-4">
            <p className="flex min-w-0 items-center gap-2 font-semibold">
                <Volume2 size={20} className="shrink-0 text-slate-400" />
                <span className="truncate">{ROOM_NAME}</span>
            </p>

            <button
                className="flex shrink-0 cursor-pointer items-center gap-2 rounded-lg bg-blue-500 px-3 py-1.5 text-sm transition-colors duration-300 hover:bg-blue-600"
                onClick={handleCopiarLink}
                title="Copiar link da sala"
            >
                {copiado ? <Check size={16} /> : <Copy size={16} />}
                <span aria-live="polite">{copiado ? "Link copiado" : "Copiar link"}</span>
            </button>
        </header>
    )
}
