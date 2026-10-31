import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

type DialogProps = {
    title: string;
    onClose: () => void;
    children: ReactNode;
}

export function Dialog({ title, onClose, children }: DialogProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const dialog = dialogRef.current;

        dialog?.showModal();

        return () => dialog?.close();
    }, []);

    return (
        <dialog
            ref={dialogRef}
            className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg bg-sidebar p-5 text-white backdrop:bg-black/60"
            onCancel={onClose}
            aria-label={title}
        >
            <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold">{title}</h2>
                <button
                    className="cursor-pointer rounded p-1 text-slate-400 hover:bg-tile hover:text-white"
                    onClick={onClose}
                    aria-label="Fechar"
                >
                    <X size={20} />
                </button>
            </div>

            {children}
        </dialog>
    )
}
