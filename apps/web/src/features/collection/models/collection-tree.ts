import type { RouterOutputs } from "server";

export type Collection = RouterOutputs["collection"]["get"];
export type CollectionDrawing = Collection["drawings"][number];
export type CollectionFolder = Collection["folders"][number];

const byName = (a: CollectionFolder, b: CollectionFolder) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });

const byRecent = (a: CollectionDrawing, b: CollectionDrawing) =>
    b.updatedAt.getTime() - a.updatedAt.getTime();

/** Helpers over a collection's flat lists of folders and drawings */
export const createCollectionTree = ({ drawings, folders }: Collection) => {
    const folderById = new Map(folders.map(folder => [folder.id, folder]));
    // A drawing in a folder that's gone counts as unsorted
    const folderOf = (drawing: CollectionDrawing) =>
        drawing.folderId && folderById.has(drawing.folderId) ? drawing.folderId : null;

    const childrenOf = new Map<number | null, CollectionFolder[]>();
    for (const folder of [...folders].sort(byName)) {
        const parentId =
            folder.parentId && folderById.has(folder.parentId) ? folder.parentId : null;
        childrenOf.set(parentId, [...(childrenOf.get(parentId) ?? []), folder]);
    }

    const drawingsOf = new Map<number | null, CollectionDrawing[]>();
    for (const drawing of [...drawings].sort(byRecent)) {
        const folderId = folderOf(drawing);
        drawingsOf.set(folderId, [...(drawingsOf.get(folderId) ?? []), drawing]);
    }

    const children = (parentId: number | null) => childrenOf.get(parentId) ?? [];

    /** The folder and every folder inside it */
    const descendantIds = (id: number): number[] => [
        id,
        ...children(id).flatMap(child => descendantIds(child.id)),
    ];

    /** The folder's parents, the top-level one first */
    const ancestors = (id: number): CollectionFolder[] => {
        const chain: CollectionFolder[] = [];
        const seen = new Set<number>();
        for (let folder = folderById.get(id); folder && !seen.has(folder.id);) {
            seen.add(folder.id);
            chain.unshift(folder);
            folder = folder.parentId ? folderById.get(folder.parentId) : undefined;
        }
        return chain;
    };

    const unfiled = drawingsOf.get(null) ?? [];

    return {
        folder: (id: number) => folderById.get(id),
        children,
        /** Drawings directly in a folder, the most recently edited first */
        drawingsIn: (folderId: number) => drawingsOf.get(folderId) ?? [],
        /** Drawings in a folder and its sub-folders */
        countIn: (id: number) =>
            descendantIds(id).reduce(
                (sum, folderId) => sum + (drawingsOf.get(folderId)?.length ?? 0),
                0
            ),
        /** Drawings in a folder and its sub-folders, the most recently edited first */
        drawingsWithin: (id: number) =>
            descendantIds(id)
                .flatMap(folderId => drawingsOf.get(folderId) ?? [])
                .sort(byRecent),
        descendantIds,
        ancestors,
        /** "Work / Architecture" */
        path: (id: number) =>
            ancestors(id)
                .map(folder => folder.name)
                .join(" / "),
        /** Every folder, in tree order, with its depth */
        flatten: () => {
            const walk = (
                parentId: number | null,
                depth: number
            ): { folder: CollectionFolder; depth: number }[] =>
                children(parentId).flatMap(folder => [
                    { folder, depth },
                    ...walk(folder.id, depth + 1),
                ]);
            return walk(null, 0);
        },
        pinned: [...drawings].filter(drawing => drawing.pinned).sort(byRecent),
        /** Your own drawings that aren't in a folder */
        unsorted: unfiled.filter(drawing => drawing.isOwner),
        /** Other people's drawings that aren't in a folder */
        shared: unfiled.filter(drawing => !drawing.isOwner),
        recent: [...drawings].sort(byRecent),
        folderOf,
    };
};

export type CollectionTree = ReturnType<typeof createCollectionTree>;

export const matchesQuery = (text: string, query: string) =>
    text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());

/** Where a drawing is: its folder, "Unsorted", or who shared it */
export const describeLocation = (tree: CollectionTree, drawing: CollectionDrawing) => {
    const folderId = tree.folderOf(drawing);
    if (folderId) return tree.path(folderId);
    if (drawing.isOwner) return "Unsorted";
    return `Shared by ${drawing.owner?.name ?? "someone"}`;
};
