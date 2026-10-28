import { ReactNode } from "react";

/** Keyboard keys, as in a shortcut */
export const Keys = ({ keys }: { keys: string[] }) => (
    <span className="inline-flex gap-1">
        {keys.map(key => (
            <kbd
                key={key}
                className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-black/10 bg-white px-1 font-sans text-[11px] font-semibold text-zinc-500 shadow-[0_1px_0_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-400"
            >
                {key}
            </kbd>
        ))}
    </span>
);

/** A shortcut and what it does, as in a palette's footer */
export const Hint = ({ keys, children }: { keys: string[]; children: ReactNode }) => (
    <span className="flex items-center gap-1.5">
        <Keys keys={keys} /> {children}
    </span>
);
