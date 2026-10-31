import { useEffect, useState } from "react";

import { keyLabel, type Preferences } from "../../services/preferences";
import type { RoomClient } from "../../services/roomClient";
import { Dialog } from "./Dialog";

type SettingsDialogProps = {
    client: RoomClient;
    preferences: Preferences;
    onClose: () => void;
}

type SeletorProps = {
    rotulo: string;
    dispositivos: MediaDeviceInfo[];
    valor: string;
    onChange: (id: string) => void;
}

function Seletor({ rotulo, dispositivos, valor, onChange }: SeletorProps) {
    return (
        <label className="mb-3 flex flex-col gap-1 text-sm text-slate-300">
            {rotulo}
            <select
                className="h-10 rounded-lg border border-slate-600 bg-rail px-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                aria-label={rotulo}
                value={dispositivos.some((d) => d.deviceId === valor) ? valor : ""}
                onChange={(event) => onChange(event.target.value)}
            >
                <option value="">Padrão do sistema</option>
                {dispositivos
                    .filter((d) => d.deviceId && !["default", "communications"].includes(d.deviceId))
                    .map((d, index) => (
                        <option key={d.deviceId} value={d.deviceId}>
                            {d.label || `${rotulo} ${index + 1}`}
                        </option>
                    ))}
            </select>
        </label>
    );
}

export function SettingsDialog({ client, preferences, onClose }: SettingsDialogProps) {
    const [dispositivos, setDispositivos] = useState<MediaDeviceInfo[]>([]);
    const [capturandoTecla, setCapturandoTecla] = useState(false);

    useEffect(() => {
        const mediaDevices = navigator.mediaDevices;

        if (!mediaDevices) {
            return;
        }

        const carregar = () => {
            mediaDevices.enumerateDevices().then(setDispositivos).catch(() => undefined);
        };

        carregar();
        mediaDevices.addEventListener("devicechange", carregar);

        return () => mediaDevices.removeEventListener("devicechange", carregar);
    }, []);

    useEffect(() => {
        if (!capturandoTecla) {
            return;
        }

        const handleTecla = (event: KeyboardEvent) => {
            event.preventDefault();

            if (event.code !== "Escape") {
                client.updatePreferences({ pushToTalkKey: event.code });
            }

            setCapturandoTecla(false);
        };

        document.addEventListener("keydown", handleTecla, { once: true });

        return () => document.removeEventListener("keydown", handleTecla);
    }, [capturandoTecla, client]);

    const porTipo = (kind: MediaDeviceKind) =>
        dispositivos.filter((dispositivo) => dispositivo.kind === kind);

    const podeEscolherSaida = "setSinkId" in HTMLMediaElement.prototype;

    return (
        <Dialog title="Configurações" onClose={onClose}>
            <Seletor
                rotulo="Microfone"
                dispositivos={porTipo("audioinput")}
                valor={preferences.micId}
                onChange={(id) => client.setMicDevice(id)}
            />

            {podeEscolherSaida && (
                <Seletor
                    rotulo="Saída de áudio"
                    dispositivos={porTipo("audiooutput")}
                    valor={preferences.speakerId}
                    onChange={(id) => client.setSpeakerDevice(id)}
                />
            )}

            <Seletor
                rotulo="Câmera"
                dispositivos={porTipo("videoinput")}
                valor={preferences.cameraId}
                onChange={(id) => client.setCameraDevice(id)}
            />

            <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm">
                <input
                    type="checkbox"
                    className="size-4 accent-blue-500"
                    checked={preferences.pushToTalk}
                    onChange={(event) => client.updatePreferences({ pushToTalk: event.target.checked })}
                />
                Apertar para falar
            </label>

            {preferences.pushToTalk && (
                <div className="mt-2 ml-6">
                    <button
                        className="cursor-pointer rounded-lg bg-tile px-3 py-1.5 text-sm transition-colors duration-200 hover:bg-slate-700"
                        onClick={() => setCapturandoTecla(true)}
                    >
                        {capturandoTecla
                            ? "Pressione uma tecla..."
                            : `Tecla: ${keyLabel(preferences.pushToTalkKey)}`}
                    </button>
                    <p className="mt-1 text-xs text-slate-400">
                        Funciona apenas com esta aba em foco.
                    </p>
                </div>
            )}

            <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm">
                <input
                    type="checkbox"
                    className="size-4 accent-blue-500"
                    checked={preferences.soundsEnabled}
                    onChange={(event) => client.updatePreferences({ soundsEnabled: event.target.checked })}
                />
                Sons de entrada, saída e mudo
            </label>
        </Dialog>
    )
}
