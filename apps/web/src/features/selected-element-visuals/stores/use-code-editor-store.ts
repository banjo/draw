import { Maybe } from "@banjoanton/utils";
import { create } from "zustand";

type UseCodeEditorStore = {
    /** The code block being typed in, if any */
    editingElementId: Maybe<string>;
    setEditingElementId: (elementId: Maybe<string>) => void;
};

export const useCodeEditorStore = create<UseCodeEditorStore>(set => ({
    editingElementId: undefined,
    setEditingElementId: (editingElementId: Maybe<string>) => set({ editingElementId }),
}));
