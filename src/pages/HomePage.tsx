import { useState } from "react";
import { useNavigate } from "react-router-dom";

function HomePage() {
    const [nome, setNome] = useState("");
    const [modoEntrar, setModoEntrar] = useState(false);
    const [codigoSala, setCodigoSala] = useState("");

    const navigate = useNavigate();

    const handleEntrarSala = () => {
        if (!nome || !codigoSala) {
            return;
        }

        navigate(`/room/${codigoSala}`);
    };

    const handleCriarSala = () => {
        if (!nome) {
            return;
        }
        const codigo = Math.random()
            .toString(36)
            .substring(2, 8)
            .toUpperCase();

        navigate(`/room/${codigo}`);
    };

    return (
        <main
            className="
        min-h-screen
        flex
        flex-col
        items-center
        justify-center
        gap-4
      "
        >
            <h1 className="text-4xl font-bold tracking-tight">
                Converse e compartilhe sua tela
            </h1>

            <p className="text-slate-300">
                Crie uma sala privada e compartilhe o link com quem quiser.
            </p>

            <input
                className="
          w-100
          h-12
          rounded-lg
          bg-[#080d18]
          border
          border-slate-600
          px-4
          text-white
          outline-none
          focus:ring-2
          focus:ring-blue-500
        "
                placeholder="Digite seu nome"
                value={nome}
                onChange={(event) => setNome(event.target.value)}
            />

            {!modoEntrar && (
                <button
                    className="
            rounded-lg
            bg-blue-500
            hover:bg-blue-600
            border
            border-slate-800
            px-9
            py-2
            cursor-pointer
            w-100
            transition-colors
            duration-300
          "
                    onClick={handleCriarSala}
                >
                    Criar sala
                </button>
            )}

            {!modoEntrar ? (
                <button
                    className="
            rounded-lg
            bg-[#080d18]
            hover:bg-slate-800
            px-9
            py-2
            cursor-pointer
            w-100
            transition-colors
            duration-300
          "
                    onClick={() => setModoEntrar(true)}
                >
                    Entrar em uma sala
                </button>
            ) : (
                <>
                    <input
                        className="
              w-100
              h-12
              rounded-lg
              bg-[#080d18]
              border
              border-slate-600
              px-4
              text-white
              outline-none
              focus:ring-2
              focus:ring-blue-500
            "
                        placeholder="Código da sala"
                        value={codigoSala}
                        onChange={(event) => setCodigoSala(event.target.value)}
                    />

                    <button
                        className="
              rounded-lg
              bg-blue-500
              hover:bg-blue-600
              px-9
              py-2
              cursor-pointer
              w-100
              transition-colors
              duration-300
            "
                        onClick={handleEntrarSala}
                    >
                        Entrar
                    </button>

                    <button
                        className="
              rounded-lg
              bg-[#080d18]
              hover:bg-slate-800
              px-9
              py-2
              cursor-pointer
              w-100
              transition-colors
              duration-300
            "
                        onClick={() => setModoEntrar(false)}
                    >
                        Voltar
                    </button>
                </>
            )}
        </main>
    );
}

export default HomePage;