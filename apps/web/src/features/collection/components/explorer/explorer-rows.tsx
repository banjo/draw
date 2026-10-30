import { Highlight } from "@/features/collection/components/highlight";
import { useExplorer } from "@/features/collection/components/explorer/explorer-context";
import { DrawingMenu, FolderMenu } from "@/features/collection/components/explorer/explorer-menus";
import { RenameInput } from "@/features/collection/components/explorer/rename-input";
import { getDragProps, useDropTarget } from "@/features/collection/hooks/use-drag-and-drop";
import {
    CollectionDrawing,
    CollectionFolder,
    describeLocation,
    NO_ACCESS_MESSAGE,
} from "@/features/collection/models/collection-tree";
import { formatAge } from "@/features/collection/models/format-age";
import { ActiveRow, useActiveRowStore } from "@/features/collection/stores/use-active-row-store";
import { DraggedItem } from "@/features/collection/stores/use-collection-drag-store";
import { ChevronRight, File, Folder, FolderOpen, Lock, PenLine, Pin, Users } from "lucide-react";
import { KeyboardEvent, MouseEvent, ReactNode, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import { cn } from "ui";

// Important, over Excalidraw's link styles
const ROW =
    "relative flex h-[30px] w-full items-center gap-2 rounded-md pr-2 text-[13.5px] !font-normal !text-[--text-primary-color] !no-underline outline-none select-none hover:bg-black/[0.04] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[--color-primary] dark:hover:bg-white/[0.06]";
const DROP_OVER = "bg-[--color-primary-light] ring-2 ring-inset ring-[--color-primary]";
const MUTED = "text-zinc-400 dark:text-zinc-500";
// Room for the menu button, which shows instead of the time or count on hover
const TRAILING =
    "shrink-0 text-xs font-normal tabular-nums group-hover:invisible [@media(hover:none)]:invisible";

const indent = (depth: number) => ({ paddingLeft: 4 + depth * 16 });

const OwnerAvatar = ({ owner }: { owner: NonNullable<CollectionDrawing["owner"]> }) =>
    owner.avatarUrl ? (
        <img
            src={owner.avatarUrl}
            alt=""
            title={owner.name ? `Shared by ${owner.name}` : undefined}
            className="h-4 w-4 shrink-0 rounded-full"
        />
    ) : (
        <span
            title={owner.name ? `Shared by ${owner.name}` : undefined}
            className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-zinc-400 text-[9px] font-bold text-white"
        >
            {owner.name?.[0]?.toUpperCase() ?? "?"}
        </span>
    );

/** Opens the row's menu on right-click */
const useRowMenu = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const onContextMenu = (event: MouseEvent) => {
        event.preventDefault();
        setIsMenuOpen(true);
    };
    return { isMenuOpen, setIsMenuOpen, onContextMenu };
};

const MenuSlot = ({ children }: { children: ReactNode }) => (
    <div className="absolute right-1 top-1/2 -translate-y-1/2">{children}</div>
);

/** The name, a field to rename it, or the name with its folder below */
const DrawingName = ({
    drawing,
    isRenaming,
    showPath,
}: {
    drawing: CollectionDrawing;
    isRenaming: boolean;
    showPath: boolean;
}) => {
    const { actions, setRenaming, query, tree } = useExplorer();

    if (isRenaming) {
        return (
            <RenameInput
                initialValue={drawing.name}
                onCommit={name => actions.renameDrawing(drawing.slug, name)}
                onDone={() => setRenaming(null)}
            />
        );
    }

    return (
        <span className="min-w-0 flex-1">
            <span className="block truncate">
                <Highlight text={drawing.name} query={query} />
            </span>
            {showPath ? (
                <span className={cn("block truncate text-[11.5px] font-normal", MUTED)}>
                    {describeLocation(tree, drawing)}
                </span>
            ) : null}
        </span>
    );
};

type DrawingIconProps = {
    drawing: CollectionDrawing;
    variant: "default" | "pinned";
    isCurrent: boolean;
};

const DrawingIcon = ({ drawing, variant, isCurrent }: DrawingIconProps) => {
    const className = "h-4 w-4 shrink-0";

    if (variant === "pinned") {
        return <Pin className={cn(className, "text-[#e8590c] dark:text-[#ff922b]")} />;
    }
    if (!drawing.hasAccess) return <Lock className={cn(className, MUTED)} />;
    if (!drawing.isOwner) return <Users className={cn(className, MUTED)} />;
    if (isCurrent) return <PenLine className={cn(className, "text-[--color-primary]")} />;
    return <File className={cn(className, MUTED)} />;
};

const PINNED_ROW = "pinned:list";
// Where the open drawing is highlighted, unless it was opened from its pinned row
const DEFAULT_ROW = "default:list";
const HIGHLIGHTED =
    "bg-[--color-primary-light] !font-semibold !text-[--color-primary] hover:bg-[--color-primary-light] dark:hover:bg-[--color-primary-light]";

const getRowClassName = (
    drawing: CollectionDrawing,
    { showPath, isHighlighted }: { showPath: boolean; isHighlighted: boolean }
) =>
    cn(
        ROW,
        showPath && "h-auto py-1.5",
        !drawing.hasAccess && "!text-zinc-400 dark:!text-zinc-500",
        isHighlighted && HIGHLIGHTED
    );

const getLockedTitle = (drawing: CollectionDrawing) =>
    drawing.hasAccess ? undefined : NO_ACCESS_MESSAGE;

/** A saved drawing the owner has made private can't be opened, so say why instead */
const explainLocked = (drawing: CollectionDrawing, event: MouseEvent) => {
    if (drawing.hasAccess) return false;
    event.preventDefault();
    toast.error(NO_ACCESS_MESSAGE);
    return true;
};

/** Whether the open drawing shows as open in this row: the one it was clicked in, or its folder */
const isRowHighlighted = (activeRow: ActiveRow | null, drawing: CollectionDrawing, row: string) => {
    // Search results show each drawing once
    if (row.endsWith(":search")) return true;
    if (activeRow?.slug !== drawing.slug) return row === DEFAULT_ROW;
    if (activeRow.row === PINNED_ROW && !drawing.pinned) return row === DEFAULT_ROW;
    return row === activeRow.row;
};

type DrawingRowProps = {
    drawing: CollectionDrawing;
    depth?: number;
    variant?: "default" | "pinned";
    /** Show the folder under the name, for search results */
    showPath?: boolean;
};

export const DrawingRow = ({
    drawing,
    depth = 0,
    variant = "default",
    showPath = false,
}: DrawingRowProps) => {
    const { currentSlug, renaming, setRenaming, tree } = useExplorer();
    const { isMenuOpen, setIsMenuOpen, onContextMenu } = useRowMenu();
    const { slug } = drawing;
    const isCurrent = slug === currentSlug;
    const activeRow = useActiveRowStore(state => state.activeRow);
    const setActiveRow = useActiveRowStore(state => state.setActiveRow);
    const row = [variant, showPath ? "search" : "list"].join(":");
    const isRenaming =
        renaming?.type === "drawing" && renaming.slug === slug && renaming.row === row;
    const startRenaming = () => setRenaming({ type: "drawing", slug, row });
    const isHighlighted = isCurrent && isRowHighlighted(activeRow, drawing, row);

    const folderId = tree.folderOf(drawing);
    const className = getRowClassName(drawing, { showPath, isHighlighted });

    const content = (
        <>
            {isHighlighted ? (
                <span className="absolute bottom-[7px] left-0 top-[7px] w-[3px] rounded-full bg-[--color-primary]" />
            ) : null}
            <DrawingIcon drawing={drawing} variant={variant} isCurrent={isCurrent} />
            <DrawingName drawing={drawing} isRenaming={isRenaming} showPath={showPath} />
            {drawing.owner ? <OwnerAvatar owner={drawing.owner} /> : null}
            <span className={cn(TRAILING, MUTED, isMenuOpen && "invisible")}>
                {formatAge(drawing.updatedAt)}
            </span>
        </>
    );

    const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "F2" && drawing.isOwner) startRenaming();
    };

    return (
        <div className="group relative" onContextMenu={onContextMenu}>
            {isRenaming ? (
                <div className={className} style={indent(depth + 0.25)}>
                    {content}
                </div>
            ) : (
                <Link
                    to={`/draw/${slug}`}
                    className={className}
                    style={indent(depth + 0.25)}
                    title={getLockedTitle(drawing)}
                    onKeyDown={onKeyDown}
                    onClick={event => {
                        if (!explainLocked(drawing, event)) setActiveRow({ slug, row });
                    }}
                    {...getDragProps({
                        type: "drawing",
                        slug,
                        folderId,
                        pinned: drawing.pinned,
                        isOwner: drawing.isOwner,
                    })}
                >
                    {content}
                </Link>
            )}
            <MenuSlot>
                <DrawingMenu
                    drawing={drawing}
                    open={isMenuOpen}
                    onOpenChange={setIsMenuOpen}
                    onRename={startRenaming}
                />
            </MenuSlot>
        </div>
    );
};

/** A folder being named. It's created once it has a name. */
export const DraftFolderRow = ({
    parentId,
    depth = 0,
}: {
    parentId: number | null;
    depth?: number;
}) => {
    const { actions, setDraftParentId, expand } = useExplorer();

    return (
        <div className={ROW} style={indent(depth)}>
            <span className="w-3.5 shrink-0" />
            <Folder className={cn("h-4 w-4 shrink-0", MUTED)} />
            <RenameInput
                initialValue=""
                placeholder="Folder name"
                onCommit={async name => {
                    await actions.createFolder(name, parentId);
                    if (parentId) expand([parentId]);
                }}
                onDone={() => setDraftParentId(undefined)}
            />
        </div>
    );
};

export const FolderRow = ({ folder, depth = 0 }: { folder: CollectionFolder; depth?: number }) => {
    const { tree, isExpanded, toggle, expand, renaming, setRenaming, actions, draftParentId } =
        useExplorer();
    const { isMenuOpen, setIsMenuOpen, onContextMenu } = useRowMenu();
    const isOpen = isExpanded(folder.id);
    const isRenaming = renaming?.type === "folder" && renaming.id === folder.id;

    const { isOver, dropProps } = useDropTarget(
        item =>
            item.type === "drawing"
                ? item.folderId !== folder.id
                : item.parentId !== folder.id && !tree.descendantIds(item.id).includes(folder.id),
        item => {
            expand([folder.id]);
            if (item.type === "drawing") void actions.moveDrawing(item.slug, folder.id);
            else
                void actions.updateFolder(
                    item.id,
                    { parentId: folder.id },
                    "Could not move the folder"
                );
        }
    );

    // Open a closed folder when something is held over it, to drop it further in
    useEffect(() => {
        if (!isOver || isOpen) return;
        const timeout = setTimeout(() => expand([folder.id]), 700);
        return () => clearTimeout(timeout);
    }, [isOver, isOpen, expand, folder.id]);

    const onKeyDown = (event: KeyboardEvent) => {
        if (isRenaming) return;
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggle(folder.id);
        }
        if (event.key === "F2") setRenaming({ type: "folder", id: folder.id });
    };

    const subFolders = tree.children(folder.id);
    const drawings = tree.drawingsIn(folder.id);
    const FolderIcon = isOpen ? FolderOpen : Folder;

    return (
        <>
            <div className="group relative" onContextMenu={onContextMenu}>
                <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={isOpen}
                    onClick={() => !isRenaming && toggle(folder.id)}
                    onKeyDown={onKeyDown}
                    className={cn(ROW, "cursor-pointer !font-semibold", isOver && DROP_OVER)}
                    style={indent(depth)}
                    {...(isRenaming
                        ? {}
                        : getDragProps({
                              type: "folder",
                              id: folder.id,
                              parentId: folder.parentId,
                          }))}
                    {...dropProps}
                >
                    <ChevronRight
                        className={cn(
                            "h-3.5 w-3.5 shrink-0 transition-transform",
                            MUTED,
                            isOpen && "rotate-90"
                        )}
                    />
                    <FolderIcon
                        className="h-4 w-4 shrink-0"
                        style={{ color: folder.color }}
                        fill={folder.color}
                        fillOpacity={0.18}
                    />
                    {isRenaming ? (
                        <RenameInput
                            initialValue={folder.name}
                            onCommit={name => actions.updateFolder(folder.id, { name })}
                            onDone={() => setRenaming(null)}
                        />
                    ) : (
                        <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                    )}
                    <span className={cn(TRAILING, MUTED, isMenuOpen && "invisible")}>
                        {tree.countIn(folder.id)}
                    </span>
                </div>
                <MenuSlot>
                    <FolderMenu folder={folder} open={isMenuOpen} onOpenChange={setIsMenuOpen} />
                </MenuSlot>
            </div>
            {isOpen ? (
                <div className="relative">
                    <span
                        className="pointer-events-none absolute bottom-1 top-0 w-px bg-black/[0.08] dark:bg-white/[0.08]"
                        style={{ left: 11 + depth * 16 }}
                    />
                    {subFolders.map(child => (
                        <FolderRow key={child.id} folder={child} depth={depth + 1} />
                    ))}
                    {draftParentId === folder.id ? (
                        <DraftFolderRow parentId={folder.id} depth={depth + 1} />
                    ) : null}
                    {drawings.map(drawing => (
                        <DrawingRow key={drawing.slug} drawing={drawing} depth={depth + 1} />
                    ))}
                    {subFolders.length === 0 &&
                    drawings.length === 0 &&
                    draftParentId !== folder.id ? (
                        <div
                            className={cn("flex h-[26px] items-center text-xs italic", MUTED)}
                            style={indent(depth + 1.4)}
                        >
                            Empty
                        </div>
                    ) : null}
                </div>
            ) : null}
        </>
    );
};

type SectionHeaderProps = {
    title: string;
    children?: ReactNode;
    accepts?: (item: DraggedItem) => boolean;
    onDrop?: (item: DraggedItem) => void;
};

/** A section title, which can take dropped rows */
export const SectionHeader = ({
    title,
    children,
    accepts = () => false,
    onDrop = () => {},
}: SectionHeaderProps) => {
    const { isOver, dropProps } = useDropTarget(accepts, onDrop);

    return (
        <div
            {...dropProps}
            className={cn(
                "mt-3 flex h-7 items-center justify-between rounded-md pl-2 pr-1 text-[11px] font-bold uppercase tracking-[0.07em]",
                MUTED,
                isOver && cn(DROP_OVER, "text-[--color-primary] dark:text-[--color-primary]")
            )}
        >
            {title}
            {children}
        </div>
    );
};
