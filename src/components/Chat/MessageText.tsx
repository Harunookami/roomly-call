const LINK = /(https?:\/\/[^\s<>"]+)/g;

type MessageTextProps = {
    text: string;
}

// Com a captura no split, as posições ímpares são sempre os links encontrados.
export function MessageText({ text }: MessageTextProps) {
    return (
        <p className="text-sm wrap-anywhere whitespace-pre-wrap text-slate-100">
            {text.split(LINK).map((parte, index) =>
                index % 2 === 1 ? (
                    <a
                        key={index}
                        className="text-blue-400 hover:underline"
                        href={parte}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                    >
                        {parte}
                    </a>
                ) : (
                    parte
                )
            )}
        </p>
    )
}
