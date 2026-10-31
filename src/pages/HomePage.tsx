import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { createRoom } from "../services/socket";
import { loadUserName, saveUserName } from "../services/userName";
import { MAX_NAME_LENGTH } from "../types/Room";

const CLASSE_INPUT = `
  w-full
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
`;

const CLASSE_BOTAO = `
  rounded-lg
  px-9
  py-2
  cursor-pointer
  w-full
  transition-colors
  duration-300
  disabled:cursor-not-allowed
  disabled:opacity-60
`;

const BOTAO_PRIMARIO = `${CLASSE_BOTAO} bg-blue-500 hover:bg-blue-600`;
const BOTAO_SECUNDARIO = `${CLASSE_BOTAO} bg-[#080d18] hover:bg-slate-800`;

function HomePage() {
    const [nome, setNome] = useState(loadUserName);
    const [modoEntrar, setModoEntrar] = useState(false);
    const [codigoSala, setCodigoSala] = useState("");
    const [criando, setCriando] = useState(false);
    const [erro, setErro] = useState("");

    const navigate = useNavigate();

    const irParaSala = (codigo: string) => {
        const nomeLimpo = nome.trim();

        saveUserName(nomeLimpo);
        navigate(`/room/${encodeURIComponent(codigo)}`, {
            state: { nome: nomeLimpo },
        });
    };

    const handleEntrarSala = () => {
        // Aceita tanto o código quanto o link completo colado.
        const codigo = codigoSala.trim().split("/").pop()?.toUpperCase();

        if (!nome.trim() || !codigo) {
            setErro("Informe seu nome e o código da sala.");
            return;
        }

        irParaSala(codigo);
    };

    const handleCriarSala = async () => {
        if (!nome.trim()) {
            setErro("Informe seu nome.");
            return;
        }

        setCriando(true);
        setErro("");

        try {
            irParaSala(await createRoom());
        } catch {
            setErro("Não foi possível criar a sala. Tente novamente.");
            setCriando(false);
        }
    };

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();

        if (modoEntrar) {
            handleEntrarSala();
        } else {
            handleCriarSala();
        }
    };

    return (
        <main
            className="
        min-h-dvh
        flex
        flex-col
        items-center
        justify-center
        gap-4
        px-4
        text-center
      "
        >
            <h1 className="text-4xl font-bold tracking-tight">
                Converse e compartilhe sua tela
            </h1>

            <p className="text-slate-300">
                Crie uma sala privada e compartilhe o link com quem quiser.
            </p>

            <form
                className="flex w-full max-w-100 flex-col gap-4"
                onSubmit={handleSubmit}
            >
                <input
                    className={CLASSE_INPUT}
                    placeholder="Digite seu nome"
                    aria-label="Seu nome"
                    maxLength={MAX_NAME_LENGTH}
                    value={nome}
                    onChange={(event) => setNome(event.target.value)}
                />

                {modoEntrar ? (
                    <>
                        <input
                            className={CLASSE_INPUT}
                            placeholder="Código da sala"
                            aria-label="Código da sala"
                            value={codigoSala}
                            onChange={(event) => setCodigoSala(event.target.value)}
                        />

                        <button className={BOTAO_PRIMARIO} type="submit">
                            Entrar
                        </button>

                        <button
                            className={BOTAO_SECUNDARIO}
                            type="button"
                            onClick={() => setModoEntrar(false)}
                        >
                            Voltar
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            className={`${BOTAO_PRIMARIO} border border-slate-800`}
                            type="submit"
                            disabled={criando}
                        >
                            {criando ? "Criando..." : "Criar sala"}
                        </button>

                        <button
                            className={BOTAO_SECUNDARIO}
                            type="button"
                            onClick={() => setModoEntrar(true)}
                        >
                            Entrar em uma sala
                        </button>
                    </>
                )}

                {erro && (
                    <p className="text-sm text-red-300" role="alert">
                        {erro}
                    </p>
                )}
            </form>
        </main>
    );
}

export default HomePage;
