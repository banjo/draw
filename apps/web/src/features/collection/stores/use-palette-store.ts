import { create } from "zustand";

type PaletteStore = {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
};

export const usePaletteStore = create<PaletteStore>(set => ({
    isOpen: false,
    setIsOpen: isOpen => set({ isOpen }),
}));
