import { Maybe } from "@banjoanton/utils";
import { create } from "zustand";

/** "new" shows the features not seen yet, "all" every feature */
export type FeaturesModalMode = "new" | "all";

type UseFeaturesModalStore = {
    mode: Maybe<FeaturesModalMode>;
    show: (mode: FeaturesModalMode) => void;
    close: () => void;
};

export const useFeaturesModalStore = create<UseFeaturesModalStore>(set => ({
    mode: undefined,
    show: mode => set({ mode }),
    close: () => set({ mode: undefined }),
}));
