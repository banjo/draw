import { create } from "zustand";

export type DraggedItem =
    | { type: "drawing"; slug: string; folderId: number | null; pinned: boolean; isOwner: boolean }
    | { type: "folder"; id: number; parentId: number | null };

type CollectionDragStore = {
    /** What's being dragged in the collection sidebar */
    dragged: DraggedItem | null;
    setDragged: (dragged: DraggedItem | null) => void;
};

export const useCollectionDragStore = create<CollectionDragStore>(set => ({
    dragged: null,
    setDragged: dragged => set({ dragged }),
}));
