import { create } from "zustand";

type useSidebarStore = {
    isSidebarOpen: boolean;
    setIsSidebarOpen: (isSidebarOpen: boolean) => void;
};

export const useSidebarStore = create<useSidebarStore>(set => ({
    isSidebarOpen: false,
    setIsSidebarOpen: (isSidebarOpen: boolean) => set({ isSidebarOpen }),
}));
