import { useCollectionActions } from "@/features/collection/hooks/use-collection";
import { CollectionTree } from "@/features/collection/models/collection-tree";
import { createContext, useContext } from "react";

export type Renaming =
    // A drawing can show twice, pinned and in its folder, so it's renamed in one row
    { type: "drawing"; slug: string; row: string } | { type: "folder"; id: number };

type ExplorerContextValue = {
    tree: CollectionTree;
    currentSlug?: string;
    query: string;
    isExpanded: (id: number) => boolean;
    toggle: (id: number) => void;
    expand: (ids: number[]) => void;
    renaming: Renaming | null;
    setRenaming: (renaming: Renaming | null) => void;
    /** Where a new folder is being named: a parent id, or null for the top level */
    draftParentId: number | null | undefined;
    setDraftParentId: (parentId: number | null | undefined) => void;
    actions: ReturnType<typeof useCollectionActions>;
};

export const ExplorerContext = createContext<ExplorerContextValue | null>(null);

export const useExplorer = () => {
    const context = useContext(ExplorerContext);
    if (!context) throw new Error("useExplorer must be used within the collection explorer");
    return context;
};
