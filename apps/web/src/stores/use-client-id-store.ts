import { uuid } from "@banjoanton/utils";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type UseLocalIdStore = {
    clientId: string;
};

const ID_KEY = "banjo-collab-id";
export const useClientIdStore = create<UseLocalIdStore>()(
    persist(
        () => ({
            clientId: uuid(),
        }),
        {
            name: ID_KEY,
            storage: createJSONStorage(() => localStorage),
        }
    )
);
