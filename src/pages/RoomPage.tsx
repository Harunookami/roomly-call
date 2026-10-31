import { useCallback, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { X } from "lucide-react";

import { Header } from "../components/Header/Header";
import type { SharedScreen } from "../components/ScreenShare/ScreenShare";
import { ParticipantList } from "../components/Participants/ParticipantList";
import { CallControls } from "../components/CallControls/CallControls";
import { ScreenShareDialog } from "../components/Dialogs/ScreenShareDialog";
import { SettingsDialog } from "../components/Dialogs/SettingsDialog";
import { RemoteAudio } from "../components/Media/RemoteAudio";
import { ChannelSidebar } from "../components/Sidebar/ChannelSidebar";
import { ServerRail } from "../components/Sidebar/ServerRail";
import { CallStage } from "../components/Stage/CallStage";
import { useRoom } from "../hooks/useRoom";
import { keyLabel } from "../services/preferences";
import type { RoomStatus } from "../services/roomClient";
import { loadUserName, saveUserName } from "../services/userName";
import type { Participant } from "../types/Participant";
import { MAX_NAME_LENGTH, MAX_PARTICIPANTS } from "../types/Room";

const MENSAGENS_FIM: Partial<Record<RoomStatus, { titulo: string; texto: string }>> = {
  "not-found": {
    titulo: "Sala não encontrada",
    texto: "Confira o código. Salas vazias são encerradas depois de um minuto.",
  },
  full: {
    titulo: "Sala cheia",
    texto: `Esta sala já tem o limite de ${MAX_PARTICIPANTS} participantes.`,
  },
  "invalid-name": {
    titulo: "Nome inválido",
    texto: "Volte ao início e informe seu nome.",
  },
  kicked: {
    titulo: "Você foi removido",
    texto: "O anfitrião removeu você da sala.",
  },
  unavailable: {
    titulo: "Servidor indisponível",
    texto: "Não foi possível conectar. Tentando novamente...",
  },
};

function TelaCentral({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#080d18] px-4 text-center text-white">
      <h1 className="text-3xl font-bold tracking-tight">{titulo}</h1>
      <p className="text-slate-300">{texto}</p>
      <Link
        className="rounded-lg bg-blue-500 px-9 py-2 transition-colors duration-300 hover:bg-blue-600"
        to="/"
      >
        Voltar ao início
      </Link>
    </main>
  );
}

function Lobby({ codigoSala, onEntrar }: { codigoSala: string; onEntrar: (nome: string) => void }) {
  const [nome, setNome] = useState(loadUserName);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (nome.trim()) {
      onEntrar(nome.trim());
    }
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#080d18] px-4 text-center text-white">
      <form className="flex w-full max-w-100 flex-col gap-4" onSubmit={handleSubmit}>
        <h1 className="text-3xl font-bold tracking-tight">Entrar na sala {codigoSala}</h1>

        <input
          className="h-12 rounded-lg border border-slate-600 bg-[#080d18] px-4 text-white outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Digite seu nome"
          aria-label="Seu nome"
          maxLength={MAX_NAME_LENGTH}
          value={nome}
          onChange={(event) => setNome(event.target.value)}
          autoFocus
        />

        <button
          className="cursor-pointer rounded-lg bg-blue-500 px-9 py-2 transition-colors duration-300 hover:bg-blue-600"
          type="submit"
        >
          Entrar
        </button>
      </form>
    </main>
  );
}

function Chamada({ codigoSala, nome }: { codigoSala: string; nome: string }) {
  const { client, state } = useRoom(codigoSala, nome);
  const [audioBloqueado, setAudioBloqueado] = useState(false);
  const [dialogo, setDialogo] = useState<"settings" | "screen" | null>(null);
  const navigate = useNavigate();

  const handleAudioBloqueado = useCallback(() => setAudioBloqueado(true), []);

  const handleAtivarAudio = () => {
    document.querySelectorAll("audio").forEach((audio) => {
      audio.play().catch(() => undefined);
    });
    setAudioBloqueado(false);
  };

  const fim = MENSAGENS_FIM[state.status];

  if (fim) {
    return <TelaCentral {...fim} />;
  }

  if (state.status === "connecting") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#080d18] text-slate-300">
        Entrando na sala...
      </main>
    );
  }

  const getCameraStream = (participant: Participant) => {
    if (!participant.cameraOn) {
      return null;
    }

    if (participant.id === state.selfId) {
      return state.localCamera;
    }

    return (
      state.remoteStreams[participant.id]?.find(
        (stream) =>
          stream.id !== participant.screenStreamId &&
          stream.getVideoTracks().length > 0
      ) ?? null
    );
  };

  const screens: SharedScreen[] = [];

  for (const participant of state.participants) {
    const stream =
      participant.id === state.selfId
        ? state.localScreen
        : state.remoteStreams[participant.id]?.find(
            (remote) => remote.id === participant.screenStreamId
          );

    if (participant.screenStreamId && stream) {
      screens.push({
        participantId: participant.id,
        label:
          participant.id === state.selfId
            ? "Sua tela"
            : `Tela de ${participant.name}`,
        stream,
      });
    }
  }

  const { preferences } = state;

  return (
    <main className="flex h-dvh bg-stage text-white">
      <ServerRail codigoSala={codigoSala} />

      <ChannelSidebar
        codigoSala={codigoSala}
        participants={state.participants}
        selfId={state.selfId}
        speakingIds={state.speakingIds}
        reconectando={state.status === "reconnecting"}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header codigoSala={codigoSala} />

        {state.status === "reconnecting" && (
          <p className="bg-orange-500/20 px-4 py-2 text-center text-sm text-orange-200" role="status">
            Conexão perdida. Tentando reconectar...
          </p>
        )}

        {state.notice && (
          <div className="flex items-center justify-center gap-2 bg-tile px-4 py-2 text-sm" role="status">
            <span>{state.notice}</span>
            <button
              className="cursor-pointer rounded p-1 hover:bg-slate-700"
              onClick={() => client.dismissNotice()}
              aria-label="Fechar aviso"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {audioBloqueado && (
          <button
            className="cursor-pointer bg-blue-500 px-4 py-2 text-sm hover:bg-blue-600"
            onClick={handleAtivarAudio}
          >
            O navegador bloqueou o som da chamada. Clique para ativar.
          </button>
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          <section className="flex shrink-0 flex-col p-4 lg:min-w-0 lg:flex-1 lg:shrink">
            <CallStage
              participants={state.participants}
              selfId={state.selfId}
              speakingIds={state.speakingIds}
              screens={screens}
              getCameraStream={getCameraStream}
            />

            {preferences.pushToTalk && state.micOn && (
              <p className={`pt-3 text-center text-xs ${state.pushToTalkPressed ? "text-speaking" : "text-slate-400"}`}>
                {state.pushToTalkPressed
                  ? "Transmitindo..."
                  : `Segure ${keyLabel(preferences.pushToTalkKey)} para falar`}
              </p>
            )}

            <div className="flex justify-center pt-4">
              <CallControls
                micOn={state.micOn}
                deafened={state.deafened}
                cameraOn={state.localCamera !== null}
                sharing={state.localScreen !== null}
                onToggleMic={() => client.toggleMic()}
                onToggleDeafen={() => client.toggleDeafen()}
                onToggleCamera={() => client.toggleCamera()}
                onToggleScreen={() =>
                  state.localScreen ? client.stopScreen() : setDialogo("screen")
                }
                onOpenSettings={() => setDialogo("settings")}
                onLeave={() => navigate("/")}
              />
            </div>
          </section>

          <aside className="shrink-0 border-t border-black/30 bg-sidebar p-2 lg:w-56 lg:overflow-y-auto lg:border-t-0">
            <ParticipantList
              participants={state.participants}
              selfId={state.selfId}
              speakingIds={state.speakingIds}
              volumes={state.volumes}
              onVolumeChange={(participantId, volume) => client.setVolume(participantId, volume)}
              onKick={(participantId) => client.kick(participantId)}
            />
          </aside>
        </div>
      </div>

      {dialogo === "settings" && (
        <SettingsDialog
          client={client}
          preferences={preferences}
          onClose={() => setDialogo(null)}
        />
      )}

      {dialogo === "screen" && (
        <ScreenShareDialog
          screenResolution={preferences.screenResolution}
          screenFps={preferences.screenFps}
          onClose={() => setDialogo(null)}
          onConfirm={(qualidade) => {
            client.updatePreferences(qualidade);
            client.startScreen();
            setDialogo(null);
          }}
        />
      )}

      {Object.entries(state.remoteStreams).flatMap(([participantId, streams]) =>
        streams.map((stream) => (
          <RemoteAudio
            key={`${participantId}-${stream.id}`}
            stream={stream}
            volume={state.volumes[participantId] ?? 1}
            muted={state.deafened}
            speakerId={preferences.speakerId}
            onBlocked={handleAudioBloqueado}
          />
        ))
      )}
    </main>
  );
}

function RoomPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const codigoSala = (id ?? "").toUpperCase();

  // O nome fica no histórico para sobreviver a um recarregamento da página.
  const nome: unknown = location.state?.nome;

  if (typeof nome !== "string" || !nome) {
    return (
      <Lobby
        codigoSala={codigoSala}
        onEntrar={(novoNome) => {
          saveUserName(novoNome);
          navigate(location.pathname, {
            replace: true,
            state: { nome: novoNome },
          });
        }}
      />
    );
  }

  return <Chamada key={codigoSala} codigoSala={codigoSala} nome={nome} />;
}

export default RoomPage;
