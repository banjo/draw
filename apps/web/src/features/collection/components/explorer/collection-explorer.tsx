import {
    ExplorerContext,
    Renaming,
    useExplorer,
} from "@/features/collection/components/explorer/explorer-context";
import {
    DraftFolderRow,
    DrawingRow,
    FolderRow,
    SectionHeader,
} from "@/features/collection/components/explorer/explorer-rows";
import { useCollection, useCollectionActions } from "@/features/collection/hooks/use-collection";
import {
    CollectionTree,
    createCollectionTree,
    matchesQuery,
} from "@/features/collection/models/collection-tree";
import { useLatestCallback } from "@/hooks/use-latest-callback";
import { useLocalStorage } from "@uidotdev/usehooks";
import { FolderOpen, FolderPlus, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const KEY_EXPANDED = "banjo-expanded-folders";

const NewFolderButton = ({ onClick }: { onClick: () => void }) => (
    <button
        type="button"
        title="New folder"
        aria-label="New folder"
        onClick={onClick}
        className="grid h-6 w-6 place-items-center rounded normal-case text-zinc-500 hover:bg-black/5 hover:text-[--text-primary-color] dark:text-zinc-400 dark:hover:bg-white/10"
    >
        <FolderPlus className="h-4 w-4" />
    </button>
);

const Sections = ({
    tree,
    draftParentId,
    onNewFolder,
}: {
    tree: CollectionTree;
    draftParentId: number | null | undefined;
    onNewFolder: () => void;
}) => {
    const { actions } = useExplorer();
    const topFolders = tree.children(null);

    return (
        <>
            {tree.pinned.length > 0 ? (
                <>
                    <SectionHeader
                        title="Pinned"
                        accepts={item => item.type === "drawing" && !item.pinned}
                        onDrop={item =>
                            item.type === "drawing" && actions.setPinned(item.slug, true)
                        }
                    />
                    {tree.pinned.map(drawing => (
                        <DrawingRow key={drawing.slug} drawing={drawing} variant="pinned" />
                    ))}
                </>
            ) : null}

            <SectionHeader
                title="Folders"
                accepts={item => item.type === "folder" && item.parentId !== null}
                onDrop={item =>
                    item.type === "folder" &&
                    actions.updateFolder(item.id, { parentId: null }, "Could not move the folder")
                }
            >
                <NewFolderButton onClick={onNewFolder} />
            </SectionHeader>
            {topFolders.map(folder => (
                <FolderRow key={folder.id} folder={folder} />
            ))}
            {draftParentId === null ? <DraftFolderRow parentId={null} /> : null}
            {topFolders.length === 0 && draftParentId !== null ? (
                <button
                    type="button"
                    onClick={onNewFolder}
                    className="flex h-[30px] w-full items-center gap-2 rounded-md px-2 text-[13px] text-zinc-500 hover:bg-black/[0.04] dark:text-zinc-400 dark:hover:bg-white/[0.06]"
                >
                    <Plus className="h-4 w-4" /> New folder
                </button>
            ) : null}

            {tree.shared.length > 0 ? (
                <>
                    <SectionHeader
                        title="Shared with me"
                        accepts={item =>
                            item.type === "drawing" && !item.isOwner && item.folderId !== null
                        }
                        onDrop={item =>
                            item.type === "drawing" && actions.moveDrawing(item.slug, null)
                        }
                    />
                    {tree.shared.map(drawing => (
                        <DrawingRow key={drawing.slug} drawing={drawing} />
                    ))}
                </>
            ) : null}

            <SectionHeader
                title="Unsorted"
                accepts={item => item.type === "drawing" && item.isOwner && item.folderId !== null}
                onDrop={item => item.type === "drawing" && actions.moveDrawing(item.slug, null)}
            />
            {tree.unsorted.map(drawing => (
                <DrawingRow key={drawing.slug} drawing={drawing} />
            ))}
        </>
    );
};

const Results = ({ tree, query }: { tree: CollectionTree; query: string }) => {
    const hits = tree.recent.filter(drawing => matchesQuery(drawing.name, query));

    return (
        <>
            <SectionHeader title={`${hits.length} ${hits.length === 1 ? "drawing" : "drawings"}`} />
            {hits.map(drawing => (
                <DrawingRow key={drawing.slug} drawing={drawing} showPath />
            ))}
            {hits.length === 0 ? (
                <p className="px-2 py-1 text-[13px] text-zinc-500 dark:text-zinc-400">
                    No drawing is called "{query.trim()}"
                </p>
            ) : null}
        </>
    );
};

const Empty = () => (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
        <FolderOpen className="h-9 w-9 text-zinc-300 dark:text-zinc-600" strokeWidth={1.5} />
        <p className="font-semibold text-[--text-primary-color]">Your collection is empty</p>
        <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Save a drawing with "Save to my collection" in the menu, or start a new one.
        </p>
    </div>
);

/** The collection sidebar: folders, pinned and shared drawings, and search */
export const CollectionExplorer = ({ currentSlug }: { currentSlug?: string }) => {
    const { data, isLoading } = useCollection();
    const actions = useCollectionActions();
    const [query, setQuery] = useState("");
    const [expandedIds, setExpandedIds] = useLocalStorage<number[]>(KEY_EXPANDED, []);
    const [renaming, setRenaming] = useState<Renaming | null>(null);
    const [draftParentId, setDraftParentId] = useState<number | null | undefined>(undefined);

    const tree = useMemo(() => (data ? createCollectionTree(data) : null), [data]);
    const expanded = useMemo(() => new Set(expandedIds), [expandedIds]);

    const expand = useLatestCallback((ids: number[]) => {
        if (ids.every(id => expanded.has(id))) return;
        setExpandedIds([...new Set([...expandedIds, ...ids])]);
    });
    const toggle = useLatestCallback((id: number) =>
        setExpandedIds(expanded.has(id) ? expandedIds.filter(x => x !== id) : [...expandedIds, id])
    );

    // Open the folders down to the open drawing
    const currentFolderId = data?.drawings.find(d => d.slug === currentSlug)?.folderId;
    const showCurrent = useLatestCallback(() => {
        if (tree && currentFolderId) expand(tree.ancestors(currentFolderId).map(f => f.id));
    });
    useEffect(showCurrent, [showCurrent, currentSlug, currentFolderId]);

    const context = useMemo(
        () =>
            tree && {
                tree,
                currentSlug,
                query,
                isExpanded: (id: number) => expanded.has(id),
                toggle,
                expand,
                renaming,
                setRenaming,
                draftParentId,
                setDraftParentId,
                actions,
            },
        [tree, currentSlug, query, expanded, toggle, expand, renaming, draftParentId, actions]
    );

    if (isLoading) {
        return <p className="px-4 py-2 text-sm text-zinc-500">Loading…</p>;
    }
    if (!data || !tree || !context) {
        return <p className="px-4 py-2 text-sm text-zinc-500">Could not load your collection.</p>;
    }

    const isEmpty = data.drawings.length === 0 && data.folders.length === 0;
    const renderBody = () => {
        if (query.trim()) return <Results tree={tree} query={query} />;
        if (isEmpty) return <Empty />;
        return (
            <Sections
                tree={tree}
                draftParentId={draftParentId}
                onNewFolder={() => setDraftParentId(null)}
            />
        );
    };

    return (
        <ExplorerContext.Provider value={context}>
            <div className="flex min-h-0 flex-1 flex-col px-2 pb-3">
                <label className="mb-1 flex h-9 shrink-0 items-center gap-2 rounded-lg bg-black/[0.04] px-2.5 text-zinc-400 focus-within:bg-transparent focus-within:ring-2 focus-within:ring-[--color-primary] dark:bg-white/[0.06]">
                    <Search className="h-4 w-4 shrink-0" />
                    <input
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                        onKeyDown={event => {
                            // Keep Excalidraw's shortcuts out of the field
                            event.stopPropagation();
                            if (event.key === "Escape") setQuery("");
                        }}
                        placeholder="Search drawings"
                        // Without Excalidraw's focus shadow, as the field shows focus itself
                        className="min-w-0 flex-1 bg-transparent text-sm text-[--text-primary-color] outline-none placeholder:text-zinc-400 focus-visible:!shadow-none"
                    />
                    {query ? (
                        <button
                            type="button"
                            aria-label="Clear search"
                            onClick={() => setQuery("")}
                            className="grid h-5 w-5 place-items-center rounded hover:text-[--text-primary-color]"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    ) : null}
                </label>

                <div className="-mx-2 min-h-0 flex-1 overflow-y-auto px-2 pb-3">{renderBody()}</div>

                <div className="-mx-2 shrink-0 border-t border-black/[0.06] px-2 pt-3 dark:border-white/[0.06]">
                    <button
                        type="button"
                        onClick={() => actions.createCollectionDrawing()}
                        className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#1b1b1f] text-sm font-semibold text-white transition active:scale-[0.98] dark:bg-white dark:text-[#111]"
                    >
                        <Plus className="h-4 w-4" /> New drawing
                    </button>
                </div>
            </div>
        </ExplorerContext.Provider>
    );
};
