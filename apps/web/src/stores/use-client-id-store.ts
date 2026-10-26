import { uuid } from "@banjoanton/utils";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type UseLocalIdStore = {
    clientId: string;
};

const ID_KEY = "banjo-collab-id";
// Per tab, so two tabs in the same browser don't ignore each other's changes
export const useClientIdStore = create<UseLocalIdStore>()(
    persist(
        () => ({
            clientId: uuid(),
        }),
        {
            name: ID_KEY,
            storage: createJSONStorage(() => sessionStorage),
        }
    )
);
