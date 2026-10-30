import { create } from "zustand";
import { persist } from "zustand/middleware";

/** "diagram" makes BanjoDraw's shapes and blocks, "mermaid" a Mermaid block */
export type AiMode = "diagram" | "mermaid";

type OpenOptions = {
    mode?: AiMode;
    /** Sent right away, e.g. what was typed in ⌘K */
    prompt?: string;
};

type AiDialogStore = {
    isOpen: boolean;
    /** The last mode used, kept between visits */
    mode: AiMode;
    prompt: string | undefined;
    open: (options?: OpenOptions) => void;
    close: () => void;
    setMode: (mode: AiMode) => void;
};

export const useAiDialogStore = create<AiDialogStore>()(
    persist(
        set => ({
            isOpen: false,
            mode: "diagram",
            prompt: undefined,
            open: ({ mode, prompt } = {}) =>
                set(state => ({ isOpen: true, mode: mode ?? state.mode, prompt })),
            close: () => set({ isOpen: false, prompt: undefined }),
            setMode: mode => set({ mode }),
        }),
        { name: "banjo-ai", partialize: ({ mode }) => ({ mode }) }
    )
);
