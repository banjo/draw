import { create } from "zustand";

/** The row a drawing was opened from, as a pinned drawing also shows in its folder */
export type ActiveRow = { slug: string; row: string };

type ActiveRowStore = {
    activeRow: ActiveRow | null;
    setActiveRow: (activeRow: ActiveRow) => void;
};

// A store, as the sidebar remounts with each drawing
export const useActiveRowStore = create<ActiveRowStore>(set => ({
    activeRow: null,
    setActiveRow: activeRow => set({ activeRow }),
}));
