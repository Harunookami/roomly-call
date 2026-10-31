const CORES = [
    "bg-blue-500",
    "bg-emerald-600",
    "bg-rose-500",
    "bg-amber-600",
    "bg-violet-500",
    "bg-cyan-600",
];

type AvatarProps = {
    name: string;
    speaking?: boolean;
    className?: string;
}

function corDoNome(name: string) {
    const soma = [...name].reduce((total, letra) => total + letra.charCodeAt(0), 0);

    return CORES[soma % CORES.length];
}

export function Avatar({ name, speaking = false, className = "size-8 text-sm" }: AvatarProps) {
    return (
        <span
            className={`flex shrink-0 items-center justify-center rounded-full font-bold uppercase transition-shadow duration-100 ${corDoNome(name)} ${className} ${
                speaking ? "ring-2 ring-speaking ring-offset-2 ring-offset-sidebar" : ""
            }`}
        >
            {name.charAt(0)}
        </span>
    )
}
