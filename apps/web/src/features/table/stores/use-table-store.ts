import { Maybe } from "@banjoanton/utils";
import { AppState } from "@excalidraw/excalidraw/types";
import { create } from "zustand";
import type { TableContent } from "../models/table-render";

export type TableCell = { row: number; column: number };

/** What the cell editor needs from the canvas, to be over its cell */
export type TableView = Pick<AppState, "scrollX" | "scrollY" | "theme"> & {
    zoom: number;
    /** The table's version, so the editor follows it when it moves or changes */
    version: number;
};

type SelectedTable = Omit<TableContent, "rows"> & { id: string; rows: number; columns: number };

type TableStore = {
    /** The table and cell being typed in, if any */
    editing: Maybe<TableCell & { id: string }>;
    view: Maybe<TableView>;
    /** The table selected on its own, for its menu */
    selected: Maybe<SelectedTable>;
    setEditing: (editing: Maybe<TableCell & { id: string }>) => void;
    setView: (view: Maybe<TableView>) => void;
    setSelected: (selected: Maybe<SelectedTable>) => void;
};

export const useTableStore = create<TableStore>(set => ({
    editing: undefined,
    view: undefined,
    selected: undefined,
    setEditing: editing => set({ editing }),
    setView: view => set({ view }),
    setSelected: selected => set({ selected }),
}));
