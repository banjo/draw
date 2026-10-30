import { Hint, Keys } from "@/components/keys";
import { Modal } from "@/components/modal";
import { Highlight } from "@/features/collection/components/highlight";
import { DrawingPreview } from "@/features/collection/components/palette/drawing-preview";
import { useCollection, useCollectionActions } from "@/features/collection/hooks/use-collection";
import {
    CollectionDrawing,
    CollectionFolder,
    CollectionTree,
    createCollectionTree,
    describeLocation,
    matchesQuery,
    NO_ACCESS_MESSAGE,
} from "@/features/collection/models/collection-tree";
import { formatAge } from "@/features/collection/models/format-age";
import { MODIFIER_LABEL } from "@/utils/platform";
import { File, Folder, Lock, PenLine, Plus, Search, Users } from "lucide-react";
import { KeyboardEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useMatch, useNavigate } from "react-router-dom";
import { cn } from "ui";

type Item = { drawing: CollectionDrawing } | { folder: CollectionFolder };
type Group = { title: string; items: Item[] };

const RECENT_COUNT = 6;

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

const tint = (color: string) => ({
    color,
    background: `color-mix(in srgb, ${color} 14%, transparent)`,
});

const getGroups = (tree: CollectionTree, query: string, scope: number | null): Group[] => {
    const q = query.trim();
    const drawings = (list: CollectionDrawing[]) =>
        list.filter(drawing => !q || matchesQuery(drawing.name, q)).map(drawing => ({ drawing }));
    const folders = (list: CollectionFolder[]) =>
        list.filter(folder => !q || matchesQuery(folder.name, q)).map(folder => ({ folder }));
    const allFolders = tree.flatten().map(entry => entry.folder);

    let groups: Group[];
    if (scope) {
        groups = [
            { title: "Folders", items: folders(tree.children(scope)) },
            {
                title: `In ${tree.folder(scope)?.name ?? "folder"}`,
                items: drawings(tree.drawingsWithin(scope)),
            },
        ];
    } else if (q) {
        groups = [
            { title: "Drawings", items: drawings(tree.recent) },
            { title: "Folders", items: folders(allFolders) },
        ];
    } else {
        groups = [
            { title: "Recent", items: drawings(tree.recent.slice(0, RECENT_COUNT)) },
            { title: "Folders", items: folders(allFolders) },
        ];
    }

    return groups.filter(group => group.items.length > 0);
};

/** The folder Tab searches in: the selected folder, or the selected drawing's folder */
const getFolderToEnter = (tree: CollectionTree, item: Item | undefined) => {
    if (!item) return null;
    return "folder" in item ? item.folder.id : tree.folderOf(item.drawing);
};

const Detail = ({ label, children }: { label: string; children: ReactNode }) => (
    <>
        <dt className="text-zinc-400">{label}</dt>
        <dd className="flex min-w-0 items-center gap-1.5 truncate">{children}</dd>
    </>
);

const DrawingDetails = ({
    drawing,
    tree,
}: {
    drawing: CollectionDrawing;
    tree: CollectionTree;
}) => {
    const folderId = tree.folderOf(drawing);
    const folder = folderId ? tree.folder(folderId) : undefined;

    return (
        <>
            {drawing.hasAccess ? (
                <DrawingPreview slug={drawing.slug} />
            ) : (
                <div className="grid aspect-[16/10] place-items-center rounded-xl bg-black/[0.03] px-6 text-center text-sm text-zinc-400 dark:bg-white/[0.03]">
                    {NO_ACCESS_MESSAGE}
                </div>
            )}
            <h3 className="truncate text-lg font-bold">{drawing.name}</h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
                <Detail label="Folder">
                    {folder ? (
                        <Folder className="h-3.5 w-3.5 shrink-0" style={{ color: folder.color }} />
                    ) : null}
                    <span className="truncate">{describeLocation(tree, drawing)}</span>
                </Detail>
                <Detail label="Owner">
                    {drawing.isOwner ? "You" : (drawing.owner?.name ?? "Someone else")}
                </Detail>
                <Detail label="Edited">{formatAge(drawing.updatedAt, { ago: true })}</Detail>
            </dl>
        </>
    );
};

const FolderDetails = ({ folder, tree }: { folder: CollectionFolder; tree: CollectionTree }) => {
    const drawings = tree.drawingsWithin(folder.id);
    const subFolders = tree.children(folder.id);
    const latest = drawings[0];

    return (
        <>
            <div
                className="grid aspect-[16/10] place-items-center rounded-xl"
                style={tint(folder.color)}
            >
                <Folder
                    className="h-14 w-14"
                    strokeWidth={1.5}
                    fill={folder.color}
                    fillOpacity={0.2}
                />
            </div>
            <h3 className="truncate text-lg font-bold">{folder.name}</h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
                <Detail label="Drawings">{drawings.length}</Detail>
                <Detail label="Folders">{subFolders.map(f => f.name).join(", ") || "None"}</Detail>
                <Detail label="Edited">
                    {latest ? formatAge(latest.updatedAt, { ago: true }) : "Empty"}
                </Detail>
            </dl>
        </>
    );
};

const ItemIcon = ({ item, currentSlug }: { item: Item; currentSlug?: string }) => {
    if ("folder" in item) {
        return (
            <span
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
                style={tint(item.folder.color)}
            >
                <Folder className="h-4 w-4" fill={item.folder.color} fillOpacity={0.2} />
            </span>
        );
    }

    const { drawing } = item;
    let Icon = File;
    if (drawing.slug === currentSlug) Icon = PenLine;
    else if (!drawing.hasAccess) Icon = Lock;
    else if (!drawing.isOwner) Icon = Users;

    return (
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-black/[0.04] text-zinc-500 dark:bg-white/[0.06] dark:text-zinc-400">
            <Icon className="h-4 w-4" />
        </span>
    );
};

const describeItem = (tree: CollectionTree, item: Item) => {
    if ("drawing" in item) return describeLocation(tree, item.drawing);

    const { folder } = item;
    const parent = folder.parentId ? tree.path(folder.parentId) : undefined;
    return [parent, plural(tree.countIn(folder.id), "drawing")].filter(Boolean).join(" · ");
};

type ItemRowProps = {
    item: Item;
    tree: CollectionTree;
    query: string;
    currentSlug?: string;
    isSelected: boolean;
    onHover: () => void;
    onOpen: (inNewTab: boolean) => void;
};

const ItemRow = ({ item, tree, query, currentSlug, isSelected, onHover, onOpen }: ItemRowProps) => {
    const isDrawing = "drawing" in item;

    return (
        <div
            role="option"
            aria-selected={isSelected}
            onMouseMove={() => !isSelected && onHover()}
            onClick={event => onOpen(event.metaKey || event.ctrlKey)}
            className={cn(
                "flex h-11 cursor-pointer items-center gap-3 rounded-lg px-2.5 text-[14.5px]",
                isSelected && "bg-[#ecebff] dark:bg-[#a8a5ff]/15"
            )}
        >
            <ItemIcon item={item} currentSlug={currentSlug} />
            <span className="min-w-0 flex-1 truncate font-medium">
                <Highlight text={isDrawing ? item.drawing.name : item.folder.name} query={query} />
            </span>
            {isSelected ? (
                <Keys keys={isDrawing ? ["↵"] : ["⇥"]} />
            ) : (
                <span className="max-w-[45%] truncate text-[12.5px] text-zinc-400">
                    {describeItem(tree, item)}
                </span>
            )}
        </div>
    );
};

const NoResults = ({ query, onCreate }: { query: string; onCreate: () => void }) => (
    <div className="flex flex-col items-center gap-4 px-6 py-12 text-center text-sm text-zinc-400">
        {query ? `No drawing is called "${query}"` : "Nothing here yet"}
        {query ? (
            <button
                type="button"
                onClick={onCreate}
                className="flex h-9 items-center gap-2 rounded-lg bg-[#1b1b1f] px-3.5 font-semibold text-white dark:bg-white dark:text-[#111]"
            >
                <Plus className="h-4 w-4" /> New drawing "{query}"
            </button>
        ) : null}
    </div>
);

/** Find a drawing in the collection by name, and open it */
export const CollectionPalette = ({ onClose }: { onClose: () => void }) => {
    const { data } = useCollection();
    const { createCollectionDrawing } = useCollectionActions();
    const navigate = useNavigate();
    const currentSlug = useMatch("/draw/:slug")?.params.slug;
    const [query, setQuery] = useState("");
    const [scope, setScope] = useState<number | null>(null);
    const [selected, setSelected] = useState(0);
    const list = useRef<HTMLDivElement>(null);

    const tree = useMemo(() => (data ? createCollectionTree(data) : null), [data]);
    const groups = useMemo(() => (tree ? getGroups(tree, query, scope) : []), [tree, query, scope]);
    const items = groups.flatMap(group => group.items);
    const index = Math.min(selected, Math.max(items.length - 1, 0));
    const current = items[index];
    const scopeFolder = scope ? tree?.folder(scope) : undefined;
    const trimmed = query.trim();

    useEffect(() => {
        list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
    }, [index, groups]);

    const enterFolder = (folderId: number | null) => {
        setScope(folderId);
        setQuery("");
        setSelected(0);
    };

    const open = (item: Item | undefined, inNewTab = false) => {
        if (!item) return;
        if ("folder" in item) {
            enterFolder(item.folder.id);
            return;
        }
        if (!item.drawing.hasAccess) {
            toast.error(NO_ACCESS_MESSAGE);
            return;
        }

        const path = `/draw/${item.drawing.slug}`;
        if (inNewTab) {
            window.open(path, "_blank");
            return;
        }
        onClose();
        navigate(path);
    };

    const createNamed = async () => {
        onClose();
        await createCollectionDrawing(trimmed);
    };

    const moveSelection = (step: number) => {
        if (items.length > 0) setSelected((index + step + items.length) % items.length);
    };

    /** What each key does. Returns false to leave the key to the field. */
    const keyActions: Record<string, (event: KeyboardEvent<HTMLInputElement>) => boolean> = {
        ArrowDown: () => {
            moveSelection(1);
            return true;
        },
        ArrowUp: () => {
            moveSelection(-1);
            return true;
        },
        Enter: event => {
            if (current) open(current, event.metaKey || event.ctrlKey);
            else if (trimmed) void createNamed();
            return true;
        },
        Tab: () => {
            const folderId = tree ? getFolderToEnter(tree, current) : null;
            if (folderId) enterFolder(folderId);
            return true;
        },
        Backspace: () => {
            if (query || !scope) return false;
            enterFolder(tree?.folder(scope)?.parentId ?? null);
            return true;
        },
        Escape: () => {
            onClose();
            return true;
        },
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        // Keep Excalidraw's shortcuts out of the field
        event.stopPropagation();
        if (keyActions[event.key]?.(event)) event.preventDefault();
    };

    const renderList = () => {
        if (!tree) return <p className="p-6 text-center text-sm text-zinc-400">Loading…</p>;
        if (groups.length === 0) return <NoResults query={trimmed} onCreate={createNamed} />;

        let position = 0;
        return groups.map(group => (
            <div key={group.title} role="group" aria-label={group.title}>
                <div className="px-2.5 pb-1.5 pt-3 text-[11px] font-bold uppercase tracking-[0.07em] text-zinc-400">
                    {group.title}
                </div>
                {group.items.map(item => {
                    const itemIndex = position++;
                    return (
                        <ItemRow
                            key={"drawing" in item ? item.drawing.slug : `folder-${item.folder.id}`}
                            item={item}
                            tree={tree}
                            query={query}
                            currentSlug={currentSlug}
                            isSelected={itemIndex === index}
                            onHover={() => setSelected(itemIndex)}
                            onOpen={inNewTab => open(item, inNewTab)}
                        />
                    );
                })}
            </div>
        ));
    };

    const renderDetails = () => {
        if (!current || !tree) return null;
        if ("folder" in current) return <FolderDetails folder={current.folder} tree={tree} />;
        return <DrawingDetails drawing={current.drawing} tree={tree} />;
    };

    return (
        <Modal.Container
            show
            setShow={onClose}
            backgroundClassName="justify-start px-4 pt-[12vh] backdrop-blur-[2px] dark:bg-opacity-60"
        >
            <div
                role="dialog"
                aria-modal
                aria-label="Find a drawing"
                className="flex h-[min(500px,74vh)] w-full max-w-[780px] flex-col overflow-hidden rounded-2xl bg-white text-[#1b1b1f] shadow-[0_30px_70px_-24px_rgba(25,25,60,0.45),0_0_0_1px_rgba(20,20,40,0.07)] duration-200 animate-in fade-in-0 zoom-in-[0.98] slide-in-from-top-2 dark:bg-[#1d1d23] dark:text-[#ececf1] dark:shadow-[0_30px_70px_-24px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.07)] dark:[color-scheme:dark]"
            >
                <label className="flex h-[60px] shrink-0 items-center gap-2.5 border-b border-black/[0.07] px-4 text-zinc-400 dark:border-white/[0.07]">
                    <Search className="h-5 w-5 shrink-0" />
                    {scopeFolder ? (
                        <span
                            className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-[13.5px] font-bold"
                            style={tint(scopeFolder.color)}
                        >
                            <Folder className="h-3.5 w-3.5" /> {scopeFolder.name}
                        </span>
                    ) : null}
                    <input
                        autoFocus
                        value={query}
                        onChange={event => {
                            setQuery(event.target.value);
                            setSelected(0);
                        }}
                        onKeyDown={onKeyDown}
                        placeholder={
                            scopeFolder
                                ? `Search in ${scopeFolder.name}`
                                : "Search drawings and folders"
                        }
                        role="combobox"
                        aria-expanded
                        aria-controls="collection-palette-list"
                        autoComplete="off"
                        spellCheck={false}
                        className="min-w-0 flex-1 bg-transparent text-lg text-[#1b1b1f] outline-none placeholder:text-zinc-400 dark:text-[#ececf1]"
                    />
                    <Keys keys={["esc"]} />
                </label>

                <div className="grid min-h-0 flex-1 md:grid-cols-[1fr_300px]">
                    <div
                        ref={list}
                        id="collection-palette-list"
                        role="listbox"
                        className="min-h-0 overflow-y-auto px-2 pb-2 md:border-r md:border-black/[0.07] md:dark:border-white/[0.07]"
                    >
                        {renderList()}
                    </div>
                    <div className="hidden min-h-0 flex-col gap-3 overflow-hidden p-[18px] md:flex">
                        {renderDetails()}
                    </div>
                </div>

                <div className="hidden h-[42px] shrink-0 items-center gap-4 border-t border-black/[0.07] bg-black/[0.02] px-4 text-[12.5px] text-zinc-500 dark:border-white/[0.07] dark:bg-white/[0.02] dark:text-zinc-400 sm:flex">
                    <Hint keys={["↑", "↓"]}>Move</Hint>
                    <Hint keys={["↵"]}>Open</Hint>
                    <Hint keys={[MODIFIER_LABEL, "↵"]}>New tab</Hint>
                    <Hint keys={["⇥"]}>Search in folder</Hint>
                    {scope ? <Hint keys={["⌫"]}>Leave folder</Hint> : null}
                </div>
            </div>
        </Modal.Container>
    );
};
