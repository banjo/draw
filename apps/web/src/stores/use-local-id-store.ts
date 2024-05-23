import { create } from "zustand";

type UseLocalIdStore = {
    localId: string;
    setLocalId: (id: string) => void;
};

export const useLocalIdStore = create<UseLocalIdStore>(set => ({
    localId: "",
    setLocalId: (id: string) => set({ localId: id }),
}));
