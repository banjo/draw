import { useExplorer } from "@/features/collection/components/explorer/explorer-context";
import { CollectionDrawing, CollectionFolder } from "@/features/collection/models/collection-tree";
import { copyToClipboard } from "@/utils/clipboard";
import { FOLDER_COLORS } from "common";
import {
    Check,
    ExternalLink,
    Folder,
    FolderInput,
    FolderPlus,
    Inbox,
    Link,
    MoreHorizontal,
    Pencil,
    Pin,
    PinOff,
    Trash2,
} from "lucide-react";
import { ReactNode } from "react";
import toast from "react-hot-toast";
import {
    cn,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "ui";

type MenuProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

const ITEM = "gap-2.5 cursor-pointer [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0 [&>svg]:opacity-70";
// Excalidraw closes an undocked sidebar on clicks outside it, which includes these menus
const PREVENT_OUTSIDE_CLICK = { "data-prevent-outside-click": true };

const MoreButton = () => (
    <DropdownMenuTrigger asChild>
        <button
            type="button"
            aria-label="More"
            // Always shown on touch screens, which have no hover
            className="grid h-6 w-6 place-items-center rounded text-zinc-500 opacity-0 hover:bg-black/5 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100 dark:text-zinc-400 dark:hover:bg-white/10 [@media(hover:none)]:opacity-100"
        >
            <MoreHorizontal className="h-4 w-4" />
        </button>
    </DropdownMenuTrigger>
);

const MenuContent = ({ children }: { children: ReactNode }) => (
    <DropdownMenuContent
        {...PREVENT_OUTSIDE_CLICK}
        align="start"
        className="w-56"
        // Keep focus in a rename field opened from the menu
        onCloseAutoFocus={event => event.preventDefault()}
    >
        {children}
    </DropdownMenuContent>
);

/** "Move to" with every folder, indented by depth */
const MoveToMenu = ({
    currentId,
    noneLabel,
    onMove,
    isDisabled = () => false,
}: {
    currentId: number | null;
    noneLabel: string;
    onMove: (folderId: number | null) => void;
    isDisabled?: (folder: CollectionFolder) => boolean;
}) => {
    const { tree } = useExplorer();
    const check = (isCurrent: boolean) =>
        isCurrent ? <Check className="ml-auto !opacity-100 text-[--color-primary]" /> : null;

    return (
        <DropdownMenuSub>
            <DropdownMenuSubTrigger className={ITEM}>
                <FolderInput /> Move to
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent
                {...PREVENT_OUTSIDE_CLICK}
                className="max-h-80 w-56 overflow-y-auto"
            >
                <DropdownMenuItem className={ITEM} onSelect={() => onMove(null)}>
                    <Inbox /> {noneLabel} {check(currentId === null)}
                </DropdownMenuItem>
                {tree.flatten().length > 0 ? <DropdownMenuSeparator /> : null}
                {tree.flatten().map(({ folder, depth }) => (
                    <DropdownMenuItem
                        key={folder.id}
                        className={ITEM}
                        style={{ paddingLeft: 8 + depth * 14 }}
                        disabled={isDisabled(folder)}
                        onSelect={() => onMove(folder.id)}
                    >
                        <Folder style={{ color: folder.color }} className="!opacity-100" />
                        <span className="truncate">{folder.name}</span>
                        {check(currentId === folder.id)}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuSubContent>
        </DropdownMenuSub>
    );
};

export const DrawingMenu = ({
    drawing,
    open,
    onOpenChange,
    onRename,
}: MenuProps & { drawing: CollectionDrawing; onRename: () => void }) => {
    const { actions, tree } = useExplorer();
    const { slug } = drawing;
    const link = `${window.location.origin}/draw/${slug}`;

    const copyLink = async () => {
        const copied = await copyToClipboard(link);
        if (copied) toast.success("Link copied");
        else toast.error("Could not copy the link");
    };

    return (
        <DropdownMenu open={open} onOpenChange={onOpenChange} modal={false}>
            <MoreButton />
            <MenuContent>
                <DropdownMenuItem className={ITEM} onSelect={() => window.open(link, "_blank")}>
                    <ExternalLink /> Open in new tab
                </DropdownMenuItem>
                {drawing.isOwner ? (
                    <DropdownMenuItem className={ITEM} onSelect={onRename}>
                        <Pencil /> Rename
                    </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                    className={ITEM}
                    onSelect={() => actions.setPinned(slug, !drawing.pinned)}
                >
                    {drawing.pinned ? <PinOff /> : <Pin />}
                    {drawing.pinned ? "Unpin" : "Pin to top"}
                </DropdownMenuItem>
                <DropdownMenuItem className={ITEM} onSelect={copyLink}>
                    <Link /> Copy link
                </DropdownMenuItem>
                <MoveToMenu
                    currentId={tree.folderOf(drawing)}
                    noneLabel={drawing.isOwner ? "Unsorted" : "Shared with me"}
                    onMove={folderId => actions.moveDrawing(slug, folderId)}
                />
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    className={cn(ITEM, "text-red-600 focus:text-red-600 dark:text-red-400")}
                    onSelect={() => actions.removeDrawing(slug)}
                >
                    <Trash2 /> Remove from collection
                </DropdownMenuItem>
            </MenuContent>
        </DropdownMenu>
    );
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export const FolderMenu = ({
    folder,
    open,
    onOpenChange,
}: MenuProps & { folder: CollectionFolder }) => {
    const { actions, setRenaming, setDraftParentId, expand, tree } = useExplorer();
    const inside = new Set(tree.descendantIds(folder.id));

    const deleteFolder = () => {
        const folders = inside.size - 1;
        const drawings = tree.countIn(folder.id);
        if (folders > 0 || drawings > 0) {
            const contents = [
                folders > 0 ? ` and ${plural(folders, "folder")} in it` : "",
                drawings > 0 ? `? ${plural(drawings, "drawing")} will move to Unsorted.` : "?",
            ].join("");
            if (!window.confirm(`Delete "${folder.name}"${contents}`)) return;
        }
        void actions.deleteFolder(folder.id, [...inside]);
    };

    return (
        <DropdownMenu open={open} onOpenChange={onOpenChange} modal={false}>
            <MoreButton />
            <MenuContent>
                <DropdownMenuItem
                    className={ITEM}
                    onSelect={() => {
                        expand([folder.id]);
                        setDraftParentId(folder.id);
                    }}
                >
                    <FolderPlus /> New folder inside
                </DropdownMenuItem>
                <DropdownMenuItem
                    className={ITEM}
                    onSelect={() => setRenaming({ type: "folder", id: folder.id })}
                >
                    <Pencil /> Rename
                </DropdownMenuItem>
                <div className="grid grid-cols-6 gap-1 px-2 py-1.5" role="group" aria-label="Color">
                    {FOLDER_COLORS.map(color => (
                        <button
                            key={color}
                            type="button"
                            aria-label={`Color ${color}`}
                            onClick={() => {
                                void actions.updateFolder(folder.id, { color });
                                onOpenChange(false);
                            }}
                            className={cn(
                                "h-5 w-5 rounded-full ring-offset-2 ring-offset-white transition hover:scale-110 dark:ring-offset-zinc-900",
                                folder.color === color && "ring-2 ring-zinc-400"
                            )}
                            style={{ background: color }}
                        />
                    ))}
                </div>
                <MoveToMenu
                    currentId={folder.parentId}
                    noneLabel="Top level"
                    isDisabled={target => inside.has(target.id)}
                    onMove={parentId => {
                        if (parentId) expand([parentId]);
                        void actions.updateFolder(
                            folder.id,
                            { parentId },
                            "Could not move the folder"
                        );
                    }}
                />
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    className={cn(ITEM, "text-red-600 focus:text-red-600 dark:text-red-400")}
                    onSelect={deleteFolder}
                >
                    <Trash2 /> Delete folder
                </DropdownMenuItem>
            </MenuContent>
        </DropdownMenu>
    );
};
