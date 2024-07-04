import { create } from "zustand";

type useAddElementStore = {
    showAddElementMenu: boolean;
    setShowAddElementMenu: (showAddElementMenu: boolean) => void;
};

export const useAddElementStore = create<useAddElementStore>(set => ({
    showAddElementMenu: false,
    setShowAddElementMenu: (showAddElementMenu: boolean) => set({ showAddElementMenu }),
}));
