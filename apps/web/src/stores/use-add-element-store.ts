import { create } from "zustand";

/** "pointer" adds where the mouse is, "center" in the middle of the screen */
type AddElementPlacement = "pointer" | "center";

type AddElementStore = {
    isOpen: boolean;
    placement: AddElementPlacement;
    open: (placement: AddElementPlacement) => void;
    toggle: (placement: AddElementPlacement) => void;
    close: () => void;
};

export const useAddElementStore = create<AddElementStore>((set, get) => ({
    isOpen: false,
    placement: "center",
    open: placement => set({ isOpen: true, placement }),
    toggle: placement => set({ isOpen: !get().isOpen, placement }),
    close: () => set({ isOpen: false }),
}));
