type HeaderProps = {
    codigoSala: string;
}

export function Header({ codigoSala }: HeaderProps) {



    return (
        <header>
            <h1>Roomly</h1>
            <span>Sala {codigoSala}</span>
        </header>
    )
}