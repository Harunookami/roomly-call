import { Link } from "react-router-dom";

function NotFoundPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-bold tracking-tight">Página não encontrada</h1>
      <p className="text-slate-300">O endereço acessado não existe.</p>
      <Link
        className="rounded-lg bg-blue-500 px-9 py-2 transition-colors duration-300 hover:bg-blue-600"
        to="/"
      >
        Voltar ao início
      </Link>
    </main>
  );
}

export default NotFoundPage;
