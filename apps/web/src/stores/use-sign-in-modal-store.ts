import { create } from "zustand";

type useSignInModalStore = {
    showSignInModal: boolean;
    setShowSignInModal: (showSignInModal: boolean) => void;
};

export const useSignInModalStore = create<useSignInModalStore>(set => ({
    showSignInModal: false,
    setShowSignInModal: (showSignInModal: boolean) => set({ showSignInModal }),
}));
