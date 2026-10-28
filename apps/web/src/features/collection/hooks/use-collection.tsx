import { useAuth } from "@/contexts/auth-context";
import { useDrawing } from "@/features/draw/hooks/base/use-drawing";
import type { Collection } from "@/features/collection/models/collection-tree";
import { useError } from "@/hooks/use-error";
import { useLatestCallback } from "@/hooks/use-latest-callback";
import { trpc } from "@/lib/trpc";
import { wrapAsync } from "@banjoanton/utils";
import { FOLDER_COLORS, FolderColor } from "common";
import { useMemo } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

export const useCollection = () => {
    const { isAuthenticated } = useAuth();
    return trpc.collection.get.useQuery(undefined, { enabled: isAuthenticated });
};

/** Changes to the collection. They show straight away, and are undone if they fail. */
export const useCollectionActions = () => {
    const utils = trpc.useUtils();
    const { handleError } = useError();
    const { createDrawing } = useDrawing();
    const navigate = useNavigate();

    const apply = async (
        update: (collection: Collection) => Collection,
        run: () => Promise<unknown>,
        errorMessage: string
    ) => {
        await utils.collection.get.cancel();
        const previous = utils.collection.get.getData();
        if (previous) utils.collection.get.setData(undefined, update(previous));

        const [, error] = await wrapAsync(run);
        if (error) {
            utils.collection.get.setData(undefined, previous);
            await handleError(error, { toast: true, errorMessage });
        }

        void utils.collection.get.invalidate();
        return !error;
    };

    const updateDrawing =
        (
            slug: string,
            changes: Partial<Collection["drawings"][number]>
        ): ((collection: Collection) => Collection) =>
        collection => ({
            ...collection,
            drawings: collection.drawings.map(d => (d.slug === slug ? { ...d, ...changes } : d)),
        });

    const updateFolders =
        (
            map: (folders: Collection["folders"]) => Collection["folders"]
        ): ((collection: Collection) => Collection) =>
        collection => ({
            ...collection,
            folders: map(collection.folders),
        });

    const moveDrawing = useLatestCallback((slug: string, folderId: number | null) =>
        apply(
            updateDrawing(slug, { folderId }),
            () => utils.client.collection.updateEntry.mutate({ slug, folderId }),
            "Could not move the drawing"
        )
    );

    const setPinned = useLatestCallback((slug: string, pinned: boolean) =>
        apply(
            updateDrawing(slug, { pinned }),
            () => utils.client.collection.updateEntry.mutate({ slug, pinned }),
            pinned ? "Could not pin the drawing" : "Could not unpin the drawing"
        )
    );

    const renameDrawing = useLatestCallback((slug: string, name: string) =>
        apply(
            updateDrawing(slug, { name }),
            () => utils.client.draw.updateDrawingName.mutate({ slug, name }),
            "Could not rename the drawing"
        )
    );

    const addDrawing = useLatestCallback(async (slug: string) => {
        const [, error] = await wrapAsync(() => utils.client.collection.add.mutate({ slug }));
        void utils.collection.get.invalidate();
        if (error) {
            await handleError(error, { toast: true, errorMessage: "Could not save the drawing" });
            return false;
        }
        return true;
    });

    /** Remove a drawing from the collection, with an undo that puts it back where it was */
    const removeDrawing = useLatestCallback(async (slug: string) => {
        const drawing = utils.collection.get.getData()?.drawings.find(d => d.slug === slug);
        const removed = await apply(
            collection => ({
                ...collection,
                drawings: collection.drawings.filter(d => d.slug !== slug),
            }),
            () => utils.client.collection.remove.mutate({ slug }),
            "Could not remove the drawing"
        );
        if (!removed || !drawing) return;

        const undo = async () => {
            const added = await addDrawing(slug);
            if (!added || (!drawing.folderId && !drawing.pinned)) return;
            await utils.client.collection.updateEntry.mutate({
                slug,
                folderId: drawing.folderId,
                pinned: drawing.pinned,
            });
            void utils.collection.get.invalidate();
        };

        toast.success(
            t => (
                // Clicking Undo doesn't close an undocked sidebar
                <span className="flex items-center gap-3" data-prevent-outside-click>
                    Removed "{drawing.name}"
                    <button
                        type="button"
                        className="font-semibold text-[#6965db] hover:underline"
                        onClick={() => {
                            toast.dismiss(t.id);
                            void undo();
                        }}
                    >
                        Undo
                    </button>
                </span>
            ),
            { duration: 6000 }
        );
    });

    /** Create a folder, and return its id */
    const createFolder = useLatestCallback(
        async (name: string, parentId: number | null, color?: FolderColor) => {
            const count = utils.collection.get.getData()?.folders.length ?? 0;
            const [folder, error] = await wrapAsync(() =>
                utils.client.collection.createFolder.mutate({
                    name,
                    parentId,
                    color: color ?? FOLDER_COLORS[count % FOLDER_COLORS.length] ?? FOLDER_COLORS[0],
                })
            );
            if (error) {
                await handleError(error, {
                    toast: true,
                    errorMessage: "Could not create the folder",
                });
                return;
            }

            utils.collection.get.setData(undefined, previous =>
                previous ? { ...previous, folders: [...previous.folders, folder] } : previous
            );
            void utils.collection.get.invalidate();
            return folder.id;
        }
    );

    const updateFolder = useLatestCallback(
        (
            id: number,
            changes: { name?: string; color?: FolderColor; parentId?: number | null },
            errorMessage = "Could not change the folder"
        ) =>
            apply(
                updateFolders(folders =>
                    folders.map(f => (f.id === id ? { ...f, ...changes } : f))
                ),
                () => utils.client.collection.updateFolder.mutate({ id, ...changes }),
                errorMessage
            )
    );

    /** Delete a folder and its sub-folders. Their drawings go back to unsorted. */
    const deleteFolder = useLatestCallback((id: number, descendantIds: number[]) => {
        const removed = new Set(descendantIds);
        return apply(
            collection => ({
                folders: collection.folders.filter(f => !removed.has(f.id)),
                drawings: collection.drawings.map(d =>
                    d.folderId && removed.has(d.folderId) ? { ...d, folderId: null } : d
                ),
            }),
            () => utils.client.collection.deleteFolder.mutate({ id }),
            "Could not delete the folder"
        );
    });

    /** Start an empty drawing in the collection, optionally with a name, and open it */
    const createCollectionDrawing = useLatestCallback(async (name?: string) => {
        const slug = await createDrawing([], []);
        if (!slug) return;

        if (name) {
            await wrapAsync(() => utils.client.draw.updateDrawingName.mutate({ slug, name }));
        }
        await addDrawing(slug);
        navigate(`/draw/${slug}`);
    });

    // The callbacks are stable, so the object can be too
    return useMemo(
        () => ({
            moveDrawing,
            setPinned,
            renameDrawing,
            addDrawing,
            removeDrawing,
            createFolder,
            updateFolder,
            deleteFolder,
            createCollectionDrawing,
        }),
        [
            moveDrawing,
            setPinned,
            renameDrawing,
            addDrawing,
            removeDrawing,
            createFolder,
            updateFolder,
            deleteFolder,
            createCollectionDrawing,
        ]
    );
};
