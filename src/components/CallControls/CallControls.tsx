import type { ReactNode } from "react";
import {
    Mic,
    MicOff,
    MonitorOff,
    MonitorUp,
    PhoneOff,
    Video,
    VideoOff,
} from "lucide-react";

type CallControlsProps = {
    micOn: boolean;
    cameraOn: boolean;
    sharing: boolean;
    onToggleMic: () => void;
    onToggleCamera: () => void;
    onToggleScreen: () => void;
    onLeave: () => void;
}

type ControlButtonProps = {
    label: string;
    className: string;
    onClick: () => void;
    children: ReactNode;
}

const NEUTRO = "bg-slate-800 hover:bg-slate-700";
const DESLIGADO = "bg-red-500/20 text-red-300 hover:bg-red-500/30";

function ControlButton({ label, className, onClick, children }: ControlButtonProps) {
    return (
        <button
            className={`flex size-12 cursor-pointer items-center justify-center rounded-full transition-colors duration-300 ${className}`}
            onClick={onClick}
            title={label}
            aria-label={label}
        >
            {children}
        </button>
    );
}

export function CallControls({
    micOn,
    cameraOn,
    sharing,
    onToggleMic,
    onToggleCamera,
    onToggleScreen,
    onLeave,
}: CallControlsProps) {
    // Navegadores de celular não oferecem captura de tela.
    const podeCompartilhar = Boolean(navigator.mediaDevices?.getDisplayMedia);

    return (
        <div className="flex items-center gap-3">
            <ControlButton
                label={micOn ? "Desligar microfone" : "Ligar microfone"}
                className={micOn ? NEUTRO : DESLIGADO}
                onClick={onToggleMic}
            >
                {micOn ? <Mic size={20} /> : <MicOff size={20} />}
            </ControlButton>

            <ControlButton
                label={cameraOn ? "Desligar câmera" : "Ligar câmera"}
                className={cameraOn ? NEUTRO : DESLIGADO}
                onClick={onToggleCamera}
            >
                {cameraOn ? <Video size={20} /> : <VideoOff size={20} />}
            </ControlButton>

            {podeCompartilhar && (
                <ControlButton
                    label={sharing ? "Parar de compartilhar" : "Compartilhar tela"}
                    className={sharing ? "bg-blue-500 hover:bg-blue-600" : NEUTRO}
                    onClick={onToggleScreen}
                >
                    {sharing ? <MonitorOff size={20} /> : <MonitorUp size={20} />}
                </ControlButton>
            )}

            <ControlButton
                label="Sair da sala"
                className="bg-red-500 hover:bg-red-600"
                onClick={onLeave}
            >
                <PhoneOff size={20} />
            </ControlButton>
        </div>
    )
}
