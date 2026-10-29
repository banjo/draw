import { Maybe } from "@banjoanton/utils";
import { create } from "zustand";

type SelectedSwimlane = { id: string; lanes: number };

type SwimlaneStore = {
    /** The swimlane selected on its own, for its menu */
    selected: Maybe<SelectedSwimlane>;
    setSelected: (selected: Maybe<SelectedSwimlane>) => void;
};

export const useSwimlaneStore = create<SwimlaneStore>(set => ({
    selected: undefined,
    setSelected: selected => set({ selected }),
}));
