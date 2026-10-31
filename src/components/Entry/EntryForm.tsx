import { useState, type FormEvent } from "react";

import { login, type LoginResult } from "../../services/session";
import { loadUserName, saveUserName } from "../../services/userName";
import { MAX_NAME_LENGTH } from "../../types/Room";

type EntryFormProps = {
    // Quem já entrou neste aparelho não precisa digitar a senha de novo.
    precisaDeSenha: boolean;
    onEntrar: (nome: string) => void;
}

const CLASSE_INPUT = "h-12 w-full rounded-lg border border-slate-600 bg-rail px-4 text-white outline-none focus:ring-2 focus:ring-blue-500";

const ERROS: Record<Exclude<LoginResult, "ok">, string> = {
    "wrong-password": "Senha incorreta.",
    locked: "Muitas tentativas erradas. Aguarde 15 minutos e tente de novo.",
    unavailable: "Não foi possível falar com o servidor. Tente novamente.",
};

export function EntryForm({ precisaDeSenha, onEntrar }: EntryFormProps) {
    const [nome, setNome] = useState(loadUserName);
    const [senha, setSenha] = useState("");
    const [enviando, setEnviando] = useState(false);
    const [erro, setErro] = useState("");

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();

        const nomeLimpo = nome.trim();

        if (!nomeLimpo) {
            setErro("Informe seu nome.");
            return;
        }

        if (precisaDeSenha) {
            setEnviando(true);
            setErro("");

            const resultado = await login(senha);

            setEnviando(false);

            if (resultado !== "ok") {
                setErro(ERROS[resultado]);
                return;
            }
        }

        saveUserName(nomeLimpo);
        onEntrar(nomeLimpo);
    };

    return (
        <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
            <h1 className="text-4xl font-bold tracking-tight">Roomly</h1>

            <p className="text-slate-300">Conversem e compartilhem a tela.</p>

            <form className="flex w-full max-w-100 flex-col gap-4" onSubmit={handleSubmit}>
                <input
                    className={CLASSE_INPUT}
                    placeholder="Digite seu nome"
                    aria-label="Seu nome"
                    autoComplete="username"
                    maxLength={MAX_NAME_LENGTH}
                    value={nome}
                    onChange={(event) => setNome(event.target.value)}
                />

                {precisaDeSenha && (
                    <input
                        className={CLASSE_INPUT}
                        type="password"
                        placeholder="Senha da sala"
                        aria-label="Senha da sala"
                        autoComplete="current-password"
                        value={senha}
                        onChange={(event) => setSenha(event.target.value)}
                    />
                )}

                <button
                    className="w-full cursor-pointer rounded-lg bg-blue-500 px-9 py-2 transition-colors duration-300 hover:bg-blue-600 disabled:cursor-wait disabled:opacity-60"
                    type="submit"
                    disabled={enviando}
                >
                    Entrar na sala
                </button>

                {erro && (
                    <p className="text-sm text-red-300" role="alert">
                        {erro}
                    </p>
                )}
            </form>
        </main>
    )
}
