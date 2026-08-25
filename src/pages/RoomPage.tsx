import { useParams } from "react-router-dom";

import { Header } from "../components/Header/Header";
import { ScreenShare } from "../components/ScreenShare/ScreenShare";
import { ParticipantList } from "../components/Participants/ParticipantList";
import { CallControls } from "../components/CallControls/CallControls";

function RoomPage() {
  const { id } = useParams();

  return (
    <main className="min-h-screen bg-[#080d18] text-white">
      <Header codigoSala={id ?? ""} />

      <div className="flex min-h-[calc(100vh-64px)]">
        <section className="flex flex-1 flex-col p-4">
          <ScreenShare />

          <div className="mt-auto flex justify-center pt-4">
            <CallControls />
          </div>
        </section>

        <aside className="w-72 border-l border-slate-800 p-4">
          <ParticipantList />
        </aside>
      </div>
    </main>
  );
}

export default RoomPage;