import { create } from "zustand";

type useExportModalStore = {
    showExportModal: boolean;
    setShowExportModal: (showSignInModal: boolean) => void;
};

export const useExportModalStore = create<useExportModalStore>(set => ({
    showExportModal: false,
    setShowExportModal: (showExportModal: boolean) => set({ showExportModal }),
}));
