import { useGlobal } from "@/contexts/global-context";
import { useAiDialogStore } from "@/features/ai/stores/use-ai-dialog-store";
import { useAddItem } from "@/features/add-element/hooks/use-add-item";
import { ElementSketch } from "@/features/add-element/components/element-sketch";
import { NativeDock } from "@/features/draw/models/native/native-dock";
import { shapes } from "@/models/shapes";
import { useAddElementStore } from "@/stores/use-add-element-store";
import { formatShortcut } from "@/utils/platform";
import { AppState } from "@excalidraw/excalidraw/types";
import { CustomElementType } from "common";
import {
    Blocks,
    Circle,
    Diamond,
    Eraser,
    Frame,
    Hand,
    Image,
    Lock,
    LucideIcon,
    MousePointer2,
    MoveUpRight,
    Pencil,
    Plus,
    Slash,
    Sparkle,
    Sparkles,
    Square,
    StickyNote,
    Type,
} from "lucide-react";
import { MouseEvent, ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "ui";

type ToolType = AppState["activeTool"]["type"];
type Tool = { type: ToolType; label: string; key: string; icon: LucideIcon };

const SELECT: Tool = { type: "selection", label: "Select", key: "V", icon: MousePointer2 };
const HAND: Tool = { type: "hand", label: "Hand", key: "H", icon: Hand };
const ARROW: Tool = { type: "arrow", label: "Arrow", key: "A", icon: MoveUpRight };
const TEXT: Tool = { type: "text", label: "Text", key: "T", icon: Type };
const IMAGE: Tool = { type: "image", label: "Image", key: "9", icon: Image };

/** Tools that share a button, which shows the one used last */
const GROUPS = {
    shapes: {
        label: "Shapes",
        tools: [
            { type: "rectangle", label: "Rectangle", key: "R", icon: Square },
            { type: "diamond", label: "Diamond", key: "D", icon: Diamond },
            { type: "ellipse", label: "Ellipse", key: "O", icon: Circle },
            { type: "line", label: "Line", key: "L", icon: Slash },
            { type: "frame", label: "Frame", key: "F", icon: Frame },
        ],
    },
    pens: {
        label: "Draw",
        tools: [
            { type: "freedraw", label: "Draw", key: "P", icon: Pencil },
            { type: "eraser", label: "Eraser", key: "E", icon: Eraser },
            { type: "laser", label: "Laser pointer", key: "K", icon: Sparkle },
        ],
    },
} satisfies Record<string, { label: string; tools: Tool[] }>;

type GroupId = keyof typeof GROUPS;
type MenuId = GroupId | "blocks";

const BLOCK_TYPES: CustomElementType[] = [
    "codeblock",
    "markdown",
    "table",
    "chart",
    "mermaid",
    "model",
    "swimlane",
    "link",
];
const BLOCKS = BLOCK_TYPES.flatMap(type => shapes.filter(shape => shape.type === type));
const STICKY_NOTE = shapes.find(shape => shape.type === "sticky-note");

// Between the dock and the zoom and undo buttons
const GAP = 12;

type Status = { tool: ToolType; isLocked: boolean; isHidden: boolean };

const getStatus = (appState: AppState): Status => ({
    tool: appState.activeTool.type,
    isLocked: appState.activeTool.locked,
    isHidden: appState.zenModeEnabled || appState.viewModeEnabled,
});

const Triangle = () => (
    <svg viewBox="0 0 6 6" className="absolute bottom-[5px] right-[5px] h-1.5 w-1.5 opacity-50">
        <path d="M6 0V6H0z" fill="currentColor" />
    </svg>
);

type TileProps = {
    icon: LucideIcon;
    label: string;
    title: string;
    isActive?: boolean;
    isLocked?: boolean;
    menu?: { isOpen: boolean };
    onClick: () => void;
};

const Tile = ({ icon: Icon, label, title, isActive, isLocked, menu, onClick }: TileProps) => (
    <button
        type="button"
        title={title}
        aria-label={label}
        aria-pressed={menu ? undefined : isActive}
        aria-haspopup={menu ? "menu" : undefined}
        aria-expanded={menu?.isOpen}
        onClick={onClick}
        className={cn(
            "relative flex h-[52px] w-[58px] shrink-0 flex-col items-center justify-center gap-[3px] rounded-[10px] text-[11px] font-medium text-[var(--color-gray-60,#7a7a7a)] transition-colors hover:bg-[var(--button-hover-bg)]",
            "max-[1279px]:h-10 max-[1279px]:w-9",
            (isActive || menu?.isOpen) &&
                "bg-[var(--color-surface-primary-container)] text-[var(--color-on-primary-container)] hover:bg-[var(--color-surface-primary-container)]"
        )}
    >
        <Icon
            className={cn(
                "h-5 w-5",
                isActive || menu?.isOpen ? "text-inherit" : "text-[var(--text-primary-color)]"
            )}
            strokeWidth={1.75}
        />
        <span className="max-[1279px]:hidden">{label}</span>
        {menu ? <Triangle /> : null}
        {isActive && isLocked ? (
            <Lock className="absolute right-1.5 top-1.5 h-2.5 w-2.5" strokeWidth={2.5} />
        ) : null}
    </button>
);

const Divider = () => (
    <div
        className="mx-1 h-6 w-px shrink-0 bg-[var(--default-border-color)] max-[1279px]:mx-0.5"
        aria-hidden
    />
);

/** Above its button: a list, or the blocks' grid. On phones, centred over the whole dock */
const Popover = ({ children, label }: { children: ReactNode; label: string }) => (
    <div
        role="menu"
        aria-label={label}
        className="dock-popover absolute bottom-[calc(100%+10px)] left-1/2 z-10 -translate-x-1/2 rounded-xl bg-[var(--island-bg-color)] p-1.5 text-[0.8125rem] text-[var(--text-primary-color)] shadow-[0_12px_32px_-12px_rgba(25,25,60,0.4),0_0_0_1px_rgba(20,20,40,0.08)] dark:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.08)]"
    >
        {children}
    </div>
);

const MenuRow = ({
    tool,
    isActive,
    onClick,
}: {
    tool: Tool;
    isActive: boolean;
    onClick: () => void;
}) => (
    <button
        type="button"
        role="menuitemradio"
        aria-checked={isActive}
        onClick={onClick}
        className={cn(
            "flex h-9 w-full min-w-[184px] items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 hover:bg-[var(--button-hover-bg)]",
            isActive &&
                "bg-[var(--color-surface-primary-container)] font-semibold text-[var(--color-on-primary-container)] hover:bg-[var(--color-surface-primary-container)]"
        )}
    >
        <tool.icon className="h-4 w-4" strokeWidth={1.75} />
        {tool.label}
        <kbd className="ml-auto rounded border border-[var(--default-border-color)] px-1.5 font-sans text-[10.5px] font-semibold opacity-70">
            {tool.key}
        </kbd>
    </button>
);

/**
 * BanjoDraw's toolbar, at the bottom instead of Excalidraw's at the top: the tools used most,
 * with the shapes and the pens in a menu each, a tray of blocks, and the palette (⌘K)
 */
const Dock = () => {
    const { excalidrawApi } = useGlobal();
    const addItem = useAddItem();
    const [status, setStatus] = useState<Status>(() =>
        excalidrawApi
            ? getStatus(excalidrawApi.getAppState())
            : { tool: "selection", isLocked: false, isHidden: false }
    );
    const [last, setLast] = useState<Record<GroupId, ToolType>>({
        shapes: "rectangle",
        pens: "freedraw",
    });
    const [menu, setMenu] = useState<MenuId>();
    const [placement, setPlacement] = useState<{ left: number; bottom: number }>();
    const [host, setHost] = useState<HTMLElement | null>(null);
    const dock = useRef<HTMLDivElement>(null);

    useEffect(() => NativeDock.onAttach(setHost), []);

    // Follows the tool, also when it's changed with a key
    useEffect(() => {
        if (!excalidrawApi) return;
        const update = (appState: AppState) => {
            const next = getStatus(appState);
            setStatus(previous =>
                previous.tool === next.tool &&
                previous.isLocked === next.isLocked &&
                previous.isHidden === next.isHidden
                    ? previous
                    : next
            );
            const group = (Object.keys(GROUPS) as GroupId[]).find(id =>
                GROUPS[id].tools.some(tool => tool.type === next.tool)
            );
            if (group) {
                setLast(previous =>
                    previous[group] === next.tool ? previous : { ...previous, [group]: next.tool }
                );
            }
        };
        update(excalidrawApi.getAppState());
        return excalidrawApi.onChange((_, appState) => update(appState));
    }, [excalidrawApi]);

    // Closes the open menu when clicking elsewhere, or with Escape
    useEffect(() => {
        if (!menu) return;
        const onPointerDown = (event: PointerEvent) => {
            if (!dock.current?.contains(event.target as Node)) setMenu(undefined);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            setMenu(undefined);
        };
        document.addEventListener("pointerdown", onPointerDown, true);
        window.addEventListener("keydown", onKeyDown, true);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown, true);
            window.removeEventListener("keydown", onKeyDown, true);
        };
    }, [menu]);

    // In the middle, unless that would cover the zoom and undo buttons on the left; on a phone,
    // in the middle of the width and just above the menu and undo bar. The names under the tools
    // are hidden on smaller screens, to make room.
    useLayoutEffect(() => {
        if (!host || !dock.current) return;
        const place = () => {
            if (!dock.current) return;
            const box = host.getBoundingClientRect();
            const half = dock.current.offsetWidth / 2;
            if (host.classList.contains("excalidraw--mobile")) {
                const bar = host.querySelector(".App-bottom-bar > .Island");
                const barBox = bar?.getBoundingClientRect();
                const bottom = barBox ? Math.max(0, box.bottom - barBox.top + GAP) : GAP;
                dock.current.style.setProperty(
                    "--dock-menu-max-height",
                    `${Math.max(44, box.height - bottom - dock.current.offsetHeight - 24)}px`
                );
                setPlacement(previous =>
                    previous?.left === box.width / 2 && previous.bottom === bottom
                        ? previous
                        : { left: box.width / 2, bottom }
                );
                return;
            }
            const footer = host.querySelector(".layer-ui__wrapper__footer");
            const footerBox = footer?.getBoundingClientRect();
            const footerLeft = footer?.querySelector(".layer-ui__wrapper__footer-left");
            const leftEnd = footerLeft ? footerLeft.getBoundingClientRect().right - box.left : 0;
            const left = Math.max(box.width / 2, leftEnd + GAP + half);
            const bottom = footerBox ? Math.max(0, box.bottom - footerBox.bottom) : 0;
            setPlacement(previous =>
                previous?.left === left && previous.bottom === bottom ? previous : { left, bottom }
            );
        };
        place();
        const resize = new ResizeObserver(place);
        [host, dock.current, host.querySelector(".App-bottom-bar > .Island")].forEach(element => {
            if (element) resize.observe(element);
        });
        // Excalidraw mounts and unmounts its footer and bottom bar, and switches device mode
        const structure = new MutationObserver(place);
        structure.observe(host, { childList: true, subtree: true });
        const device = new MutationObserver(place);
        device.observe(host, { attributes: true, attributeFilter: ["class"] });
        window.addEventListener("resize", place);
        return () => {
            resize.disconnect();
            structure.disconnect();
            device.disconnect();
            window.removeEventListener("resize", place);
        };
    }, [host, status.isHidden]);

    if (status.isHidden || !excalidrawApi) return null;

    const choose = (type: ToolType) => {
        setMenu(undefined);
        excalidrawApi.setActiveTool({ type } as Parameters<typeof excalidrawApi.setActiveTool>[0]);
    };

    const toggleMenu = (id: MenuId) => setMenu(menu === id ? undefined : id);

    const tile = (tool: Tool) => (
        <Tile
            icon={tool.icon}
            label={tool.label}
            title={`${tool.label} — ${tool.key}`}
            isActive={status.tool === tool.type}
            isLocked={status.isLocked}
            onClick={() => choose(tool.type)}
        />
    );

    /** Follows the pointer from where it was clicked, until a click puts it down */
    const add = (shape: (typeof shapes)[number] | undefined, event: MouseEvent) => {
        setMenu(undefined);
        // Clicked with the keyboard: in the middle of the screen
        const pointer = event.detail > 0 ? event : undefined;
        if (shape) void addItem({ kind: "element", shape }, pointer);
    };

    /** Picks the group's last tool, or when it's already picked, shows the others */
    const group = (id: GroupId) => {
        const { label, tools } = GROUPS[id];
        const current = tools.find(tool => tool.type === last[id]) ?? tools[0]!;
        const isActive = tools.some(tool => tool.type === status.tool);
        return (
            <div className="relative">
                <Tile
                    icon={current.icon}
                    label={label}
                    title={`${current.label} — ${current.key}. Click again for more`}
                    isActive={isActive}
                    isLocked={status.isLocked}
                    menu={{ isOpen: menu === id }}
                    onClick={() => (isActive ? toggleMenu(id) : choose(current.type))}
                />
                {menu === id ? (
                    <Popover label={label}>
                        {tools.map(tool => (
                            <MenuRow
                                key={tool.type}
                                tool={tool}
                                isActive={status.tool === tool.type}
                                onClick={() => choose(tool.type)}
                            />
                        ))}
                        {id === "shapes" ? (
                            <>
                                <div className="mx-1 my-1 h-px bg-[var(--default-border-color)]" />
                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={event => add(STICKY_NOTE, event)}
                                    className="flex h-9 w-full min-w-[184px] items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 hover:bg-[var(--button-hover-bg)]"
                                >
                                    <StickyNote className="h-4 w-4" strokeWidth={1.75} />
                                    Sticky note
                                </button>
                            </>
                        ) : null}
                    </Popover>
                ) : null}
            </div>
        );
    };

    return (
        <div
            ref={dock}
            role="toolbar"
            aria-label="Tools"
            style={placement}
            className={cn(
                "pointer-events-auto absolute flex -translate-x-1/2 items-center gap-1 rounded-2xl bg-[var(--island-bg-color)] p-1.5 shadow-[0_10px_30px_-12px_rgba(25,25,60,0.3),0_0_0_1px_rgba(20,20,40,0.07)] dark:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.08)]",
                !placement && "invisible"
            )}
        >
            {tile(SELECT)}
            {tile(HAND)}
            <Divider />
            {group("shapes")}
            {tile(ARROW)}
            {tile(TEXT)}
            {group("pens")}
            <Divider />
            <div className="relative">
                <Tile
                    icon={Blocks}
                    label="Blocks"
                    title="Code, notes, tables, charts and more"
                    menu={{ isOpen: menu === "blocks" }}
                    onClick={() => toggleMenu("blocks")}
                />
                {menu === "blocks" ? (
                    <Popover label="Blocks">
                        <div className="grid w-[392px] grid-cols-4 gap-1.5 p-1">
                            {BLOCKS.map(shape => (
                                <button
                                    key={shape.type}
                                    type="button"
                                    role="menuitem"
                                    title={shape.description}
                                    onClick={event => add(shape, event)}
                                    className="flex h-[72px] flex-col items-center justify-center gap-1.5 rounded-lg text-[12px] font-medium text-[var(--text-primary-color)] shadow-[inset_0_0_0_1px_var(--default-border-color)] hover:bg-[var(--button-hover-bg)]"
                                >
                                    <ElementSketch type={shape.type} />
                                    {shape.title}
                                </button>
                            ))}
                        </div>
                    </Popover>
                ) : null}
            </div>
            {tile(IMAGE)}
            <Tile
                icon={Sparkles}
                label="AI"
                title="Create or change a diagram with AI"
                onClick={() => {
                    setMenu(undefined);
                    useAiDialogStore.getState().open();
                }}
            />
            <Divider />
            <button
                type="button"
                aria-label="Add"
                title={`Add a shape, block or icon — ${formatShortcut("K")}`}
                onClick={() => {
                    setMenu(undefined);
                    useAddElementStore.getState().toggle("center");
                }}
                className={cn(
                    "flex h-[52px] shrink-0 items-center gap-2 rounded-[10px] bg-[var(--color-primary)] px-3.5 text-[13px] font-semibold text-[var(--color-surface-lowest,#fff)] transition-colors hover:bg-[var(--color-primary-darker)]",
                    "max-[1279px]:h-10 max-[1279px]:px-2.5"
                )}
            >
                <Plus className="h-5 w-5" strokeWidth={2} />
                <span className="max-[1279px]:hidden">Add</span>
                <kbd
                    className={cn(
                        "rounded border border-current/30 bg-white/20 px-1 font-sans text-[10.5px] font-semibold",
                        "max-[1279px]:hidden"
                    )}
                >
                    {formatShortcut("K")}
                </kbd>
            </button>
        </div>
    );
};

/** In Excalidraw's UI, on computers and phones: at the bottom, in two rows on a phone */
export const DockContainer = () => createPortal(<Dock />, NativeDock.container);
