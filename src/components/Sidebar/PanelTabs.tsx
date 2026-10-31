export type PanelTab<T extends string> = {
    id: T;
    label: string;
    badge?: number;
}

type PanelTabsProps<T extends string> = {
    tabs: PanelTab<T>[];
    active: T;
    onChange: (id: T) => void;
    className: string;
    label: string;
}

export function PanelTabs<T extends string>({ tabs, active, onChange, className, label }: PanelTabsProps<T>) {
    return (
        <div className={`shrink-0 gap-1 border-b border-black/30 p-1 ${className}`} role="tablist" aria-label={label}>
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded px-2 py-1.5 text-sm transition-colors duration-200 ${
                        tab.id === active
                            ? "bg-tile font-medium"
                            : "text-slate-300 hover:bg-tile/60"
                    }`}
                    onClick={() => onChange(tab.id)}
                    role="tab"
                    aria-selected={tab.id === active}
                >
                    {tab.label}

                    {Boolean(tab.badge) && (
                        <span
                            className="rounded-full bg-red-500 px-1.5 text-xs font-bold"
                            aria-label={`${tab.badge} não lidas`}
                        >
                            {tab.badge}
                        </span>
                    )}
                </button>
            ))}
        </div>
    )
}
