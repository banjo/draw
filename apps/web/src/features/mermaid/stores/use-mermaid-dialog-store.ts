import { Placement } from "@/features/add-element/hooks/use-insert-element";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/** "shapes" turns a diagram into Excalidraw shapes, "block" keeps it as Mermaid */
export type MermaidMode = "shapes" | "block";

/** A new diagram, added at the placement, or a Mermaid block being changed */
export type MermaidTarget = { kind: "insert"; placement: Placement } | { kind: "edit"; id: string };

type MermaidDialogStore = {
    target: MermaidTarget | undefined;
    /** The last mode a diagram was added with, kept between visits */
    mode: MermaidMode;
    open: (target: MermaidTarget) => void;
    close: () => void;
    setMode: (mode: MermaidMode) => void;
};

export const useMermaidDialogStore = create<MermaidDialogStore>()(
    persist(
        set => ({
            target: undefined,
            mode: "shapes",
            open: target => set({ target }),
            close: () => set({ target: undefined }),
            setMode: mode => set({ mode }),
        }),
        { name: "banjo-mermaid", partialize: ({ mode }) => ({ mode }) }
    )
);
