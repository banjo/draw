import { create } from "zustand";

type UseChangeElementStore = {
    showChangeElementDialog: boolean;
    setShowChangeElementDialog: (showTabDialog: boolean) => void;
    metaKeyIsDown: boolean;
    setMetaKeyIsDown: (metaKeyIsDown: boolean) => void;
};

export const useChangeElementStore = create<UseChangeElementStore>(set => ({
    showChangeElementDialog: false,
    setShowChangeElementDialog: (showChangeElementDialog: boolean) =>
        set({ showChangeElementDialog }),
    metaKeyIsDown: false,
    setMetaKeyIsDown: (metaKeyIsDown: boolean) => set({ metaKeyIsDown }),
}));
