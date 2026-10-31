import { Link } from "react-router-dom";
import { House } from "lucide-react";

type ServerRailProps = {
    codigoSala: string;
}

export function ServerRail({ codigoSala }: ServerRailProps) {
    return (
        <nav className="hidden w-16 shrink-0 flex-col items-center gap-2 bg-rail py-3 lg:flex" aria-label="Navegação">
            <Link
                className="flex size-11 items-center justify-center rounded-full bg-tile transition-all duration-200 hover:rounded-xl hover:bg-blue-500"
                to="/"
                title="Sair da sala e voltar ao início"
                aria-label="Sair da sala e voltar ao início"
            >
                <House size={20} />
            </Link>

            <span className="h-px w-8 bg-slate-700" />

            <span
                className="flex size-11 items-center justify-center rounded-xl bg-blue-500 text-sm font-bold"
                title={`Sala ${codigoSala}`}
            >
                {codigoSala.slice(0, 2)}
            </span>
        </nav>
    )
}
