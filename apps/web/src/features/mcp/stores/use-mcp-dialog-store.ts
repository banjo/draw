import { create } from "zustand";

type McpDialogStore = {
    isOpen: boolean;
    open: () => void;
    close: () => void;
};

export const useMcpDialogStore = create<McpDialogStore>()(set => ({
    isOpen: false,
    open: () => set({ isOpen: true }),
    close: () => set({ isOpen: false }),
}));
