import { create } from "zustand";

type UseVisualElementStore = {
    showVisualElements: boolean;
    setShowVisualElements: (show: boolean) => void;
    metaKeyIsDown: boolean;
    setMetaKeyIsDown: (metaKeyIsDown: boolean) => void;
};

export const useVisualElementStore = create<UseVisualElementStore>(set => ({
    showVisualElements: false,
    setShowVisualElements: (show: boolean) => set({ showVisualElements: show }),
    metaKeyIsDown: false,
    setMetaKeyIsDown: (metaKeyIsDown: boolean) => set({ metaKeyIsDown }),
}));
