import type { ReactNode } from "react";
import {
    Headphones,
    HeadphoneOff,
    Mic,
    MicOff,
    MonitorOff,
    MonitorUp,
    PhoneOff,
    Settings,
    Video,
    VideoOff,
} from "lucide-react";

type CallControlsProps = {
    micOn: boolean;
    deafened: boolean;
    cameraOn: boolean;
    sharing: boolean;
    onToggleMic: () => void;
    onToggleDeafen: () => void;
    onToggleCamera: () => void;
    onToggleScreen: () => void;
    onOpenSettings: () => void;
    onLeave: () => void;
}

type ControlButtonProps = {
    label: string;
    className: string;
    onClick: () => void;
    children: ReactNode;
}

const NEUTRO = "bg-tile hover:bg-slate-700";
const DESLIGADO = "bg-red-500/20 text-red-300 hover:bg-red-500/30";

function ControlButton({ label, className, onClick, children }: ControlButtonProps) {
    return (
        <button
            className={`flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-300 sm:size-12 ${className}`}
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
    deafened,
    cameraOn,
    sharing,
    onToggleMic,
    onToggleDeafen,
    onToggleCamera,
    onToggleScreen,
    onOpenSettings,
    onLeave,
}: CallControlsProps) {
    // Navegadores de celular não oferecem captura de tela.
    const podeCompartilhar = Boolean(navigator.mediaDevices?.getDisplayMedia);

    return (
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            <ControlButton
                label={micOn ? "Desligar microfone" : "Ligar microfone"}
                className={micOn ? NEUTRO : DESLIGADO}
                onClick={onToggleMic}
            >
                {micOn ? <Mic size={20} /> : <MicOff size={20} />}
            </ControlButton>

            <ControlButton
                label={deafened ? "Ativar áudio" : "Ensurdecer"}
                className={deafened ? DESLIGADO : NEUTRO}
                onClick={onToggleDeafen}
            >
                {deafened ? <HeadphoneOff size={20} /> : <Headphones size={20} />}
            </ControlButton>

            <ControlButton
                label={cameraOn ? "Desligar câmera" : "Ligar câmera"}
                className={cameraOn ? "bg-blue-500 hover:bg-blue-600" : NEUTRO}
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

            <ControlButton label="Configurações" className={NEUTRO} onClick={onOpenSettings}>
                <Settings size={20} />
            </ControlButton>

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
