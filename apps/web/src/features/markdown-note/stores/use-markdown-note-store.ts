import { Maybe } from "@banjoanton/utils";
import { create } from "zustand";
import type { NoteLook } from "../models/note-render";

type SelectedNote = { id: string; look: NoteLook; width: number };

type MarkdownNoteStore = {
    /** The note being written in, if any */
    editingId: Maybe<string>;
    /** The note selected on its own, for its menu */
    selected: Maybe<SelectedNote>;
    setEditingId: (id: Maybe<string>) => void;
    setSelected: (selected: Maybe<SelectedNote>) => void;
};

export const useMarkdownNoteStore = create<MarkdownNoteStore>(set => ({
    editingId: undefined,
    selected: undefined,
    setEditingId: editingId => set({ editingId }),
    setSelected: selected => set({ selected }),
}));
