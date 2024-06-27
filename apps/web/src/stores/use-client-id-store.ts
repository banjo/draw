import { Maybe } from "@banjoanton/utils";
import { create } from "zustand";

type UseLocalIdStore = {
    clientId: Maybe<string>;
    setClientId: (id: string) => void;
};

// TODO: use localStorage to persist the client id instead of own implementaion?
export const useClientIdStore = create<UseLocalIdStore>(set => ({
    clientId: undefined,
    setClientId: (id: string) => set({ clientId: id }),
}));
