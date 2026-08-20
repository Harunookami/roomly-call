function HomePage() {

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
            />

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
            transition-colors duration-300
            "
            >
                Criar sala
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
         transition-colors duration-300
        "
            >
                Entrar em uma sala
            </button>
        </main>
    );
}

export default HomePage;