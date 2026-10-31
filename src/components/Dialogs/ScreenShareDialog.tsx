import { useState } from "react";

import type { ScreenFps, ScreenResolution } from "../../services/preferences";
import { Dialog } from "./Dialog";

type Qualidade = {
    screenResolution: ScreenResolution;
    screenFps: ScreenFps;
}

type ScreenShareDialogProps = Qualidade & {
    onConfirm: (qualidade: Qualidade) => void;
    onClose: () => void;
}

type OpcoesProps<T extends number> = {
    legenda: string;
    opcoes: T[];
    valor: T;
    sufixo: string;
    onChange: (valor: T) => void;
}

function Opcoes<T extends number>({ legenda, opcoes, valor, sufixo, onChange }: OpcoesProps<T>) {
    return (
        <fieldset className="mb-4">
            <legend className="mb-2 text-sm text-slate-300">{legenda}</legend>

            <div className="flex gap-2">
                {opcoes.map((opcao) => (
                    <label
                        key={opcao}
                        className={`flex-1 cursor-pointer rounded-lg py-2 text-center text-sm transition-colors duration-200 has-focus-visible:ring-2 has-focus-visible:ring-white ${
                            opcao === valor ? "bg-blue-500" : "bg-tile hover:bg-slate-700"
                        }`}
                    >
                        <input
                            type="radio"
                            className="sr-only"
                            name={legenda}
                            checked={opcao === valor}
                            onChange={() => onChange(opcao)}
                        />
                        {opcao}{sufixo}
                    </label>
                ))}
            </div>
        </fieldset>
    );
}

export function ScreenShareDialog({ screenResolution, screenFps, onConfirm, onClose }: ScreenShareDialogProps) {
    const [resolucao, setResolucao] = useState(screenResolution);
    const [fps, setFps] = useState(screenFps);

    return (
        <Dialog title="Compartilhar tela" onClose={onClose}>
            <Opcoes<ScreenResolution>
                legenda="Resolução"
                opcoes={[720, 1080]}
                valor={resolucao}
                sufixo="p"
                onChange={setResolucao}
            />

            <Opcoes<ScreenFps>
                legenda="Taxa de quadros"
                opcoes={[15, 30, 60]}
                valor={fps}
                sufixo=" fps"
                onChange={setFps}
            />

            <p className="mb-4 text-xs text-slate-400">
                Você envia uma cópia da tela para cada participante, então qualidades
                mais altas consomem mais internet em salas maiores.
            </p>

            <button
                className="w-full cursor-pointer rounded-lg bg-blue-500 py-2 transition-colors duration-300 hover:bg-blue-600"
                onClick={() => onConfirm({ screenResolution: resolucao, screenFps: fps })}
            >
                Escolher tela
            </button>
        </Dialog>
    )
}
