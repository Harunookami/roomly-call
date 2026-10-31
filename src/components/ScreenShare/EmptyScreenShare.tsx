import { MonitorUp } from "lucide-react";

export function EmptyScreenShare() {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-slate-400">
            <MonitorUp size={40} />
            <p>Ninguém está compartilhando a tela.</p>
        </div>
    )
}
