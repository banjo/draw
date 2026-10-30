import { create } from "zustand";

type ShareDialogStore = {
    /** The drawing being shared, when the window is open */
    slug?: string;
    open: (slug: string) => void;
    close: () => void;
};

export const useShareDialogStore = create<ShareDialogStore>(set => ({
    slug: undefined,
    open: slug => set({ slug }),
    close: () => set({ slug: undefined }),
}));
