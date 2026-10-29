import { Maybe } from "@banjoanton/utils";
import { create } from "zustand";
import type { ChartContent } from "../models/chart-render";

type SelectedChart = Omit<ChartContent, "rows" | "title"> & { id: string };

type ChartStore = {
    /** The chart whose data is being edited, if any */
    editingId: Maybe<string>;
    /** The chart selected on its own, for its menu */
    selected: Maybe<SelectedChart>;
    setEditingId: (id: Maybe<string>) => void;
    setSelected: (selected: Maybe<SelectedChart>) => void;
};

export const useChartStore = create<ChartStore>(set => ({
    editingId: undefined,
    selected: undefined,
    setEditingId: editingId => set({ editingId }),
    setSelected: selected => set({ selected }),
}));
