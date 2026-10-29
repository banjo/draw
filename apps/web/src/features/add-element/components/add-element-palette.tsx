import { Hint, Keys } from "@/components/keys";
import { Modal } from "@/components/modal";
import { Highlight } from "@/features/collection/components/highlight";
import { useMarkdownNoteStore } from "@/features/markdown-note/stores/use-markdown-note-store";
import { useMermaidDialogStore } from "@/features/mermaid/stores/use-mermaid-dialog-store";
import { useTableStore } from "@/features/table/stores/use-table-store";
import { useChartStore } from "@/features/chart/stores/use-chart-store";
import { useLinkCardStore } from "@/features/link-card/stores/use-link-card-store";
import { useCodeEditorStore } from "@/features/selected-element-visuals/stores/use-code-editor-store";
import { useDebounce } from "@uidotdev/usehooks";
import { ChevronRight, Search } from "lucide-react";
import { KeyboardEvent, MouseEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { cn } from "ui";
import { Bounds, ClientPoint, Placement, useInsertElement } from "../hooks/use-insert-element";
import {
    ALL_SCOPE,
    BrowseItem,
    getItemDescription,
    getItemKey,
    getItemTitle,
    getParentScope,
    getScopeLabel,
    getScopePath,
    isOpener,
    isSameScope,
    Item,
    MoreItem,
    parseItemKey,
    Scope,
} from "../models/add-element-item";
import { getIconSet, ICON_SETS, IconSetId } from "../models/icon-sets";
import { Direction, getSections, moveSelection, Section } from "../models/palette-sections";
import {
    useIconCollectionQuery,
    useIconCollectionsQuery,
    useIconSearchQuery,
} from "../queries/use-icon-queries";
import { useRecentElementsStore } from "../stores/use-recent-elements-store";
import { ElementSketch } from "./element-sketch";
import { IconImage, ItemThumb } from "./item-visual";
import { ShapeTile } from "./shape-tile";

/** On the palette, so ⌘K inside it closes it instead of being typed */
export const PALETTE_ATTRIBUTE = "data-add-element-palette";

// Large sets are shown a part at a time, more as you scroll
const RENDER_STEP = 300;

const ARROWS: Record<string, Direction> = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
};

const KINDS: { label: string; scope: Scope }[] = [
    { label: "All", scope: ALL_SCOPE },
    { label: "Shapes", scope: { kind: "shape" } },
    { label: "Blocks", scope: { kind: "block" } },
    { label: "Icons", scope: { kind: "icons" } },
];

/** Searched here rather than by Iconify, so loaded whole */
const LOCAL_SETS = ICON_SETS.filter(set => set.countryCodes).map(set => set.id);

const SELECTED = "bg-[#ecebff] dark:bg-[#a8a5ff]/15";

/** The sets Iconify searches for the scope, as flags and open sets are searched here */
const getSearchedSets = (scope: Scope, isSetLoaded: boolean): IconSetId[] => {
    if (scope.kind === "all" || (scope.kind === "icons" && !scope.set)) {
        return ICON_SETS.filter(set => !set.countryCodes).map(set => set.id);
    }
    if (
        scope.kind === "icons" &&
        scope.set &&
        !isSetLoaded &&
        !getIconSet(scope.set).countryCodes
    ) {
        return [scope.set];
    }
    return [];
};

/** Only as many items as are shown, so the keys don't move to ones that aren't */
const limitSections = (sections: Section[], limit: number) => {
    let left = limit;
    return sections.map(section => {
        const items = section.items.slice(0, Math.max(left, 0));
        left -= items.length;
        return { ...section, items };
    });
};

/** A tag the item was found by, when its name doesn't say why */
const getMatchedTag = (item: Item, query: string) => {
    if (item.kind !== "element" || !query) return undefined;
    const q = query.toLowerCase();
    if ((item.shape.title ?? "").toLowerCase().includes(q)) return undefined;
    return item.shape.tags.find(tag => tag.includes(q));
};

const compactNumber = (count: number) =>
    new Intl.NumberFormat("en", { notation: "compact" }).format(count);

type RowProps = {
    item: Item;
    query: string;
    isSelected: boolean;
    onHover: () => void;
    onClick: (event: MouseEvent) => void;
};

const Row = ({ item, query, isSelected, onHover, onClick }: RowProps) => {
    const tag = getMatchedTag(item, query);

    return (
        <div
            role="option"
            aria-selected={isSelected}
            onMouseMove={() => !isSelected && onHover()}
            onMouseDown={event => event.preventDefault()}
            onClick={onClick}
            className={cn(
                "flex h-12 cursor-pointer items-center gap-3 rounded-lg px-2.5 text-[14.5px]",
                isSelected && SELECTED
            )}
        >
            <ItemThumb item={item} />
            <span className="shrink-0 font-semibold">
                <Highlight text={getItemTitle(item)} query={query} />
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-500 dark:text-zinc-400">
                {getItemDescription(item)}
                {tag ? (
                    <>
                        {" · "}
                        <Highlight text={tag} query={query} />
                    </>
                ) : null}
            </span>
            {isSelected ? <Keys keys={["↵"]} /> : null}
            {!isSelected && item.kind === "browse" ? (
                <ChevronRight className="h-4 w-4 text-zinc-400" />
            ) : null}
        </div>
    );
};

const Tile = ({ item, isSelected, onHover, onClick }: Omit<RowProps, "query">) => (
    <div
        role="option"
        aria-selected={isSelected}
        aria-label={getItemTitle(item)}
        title={getItemTitle(item)}
        onMouseMove={() => !isSelected && onHover()}
        onMouseDown={event => event.preventDefault()}
        onClick={onClick}
        className={cn(
            "relative aspect-square cursor-pointer rounded-lg bg-black/[0.03] text-[#1e1e1e] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)] transition-colors hover:bg-black/[0.06] dark:bg-white/[0.04] dark:text-[#d8d8d8] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] dark:hover:bg-white/[0.08]",
            isSelected &&
                cn(
                    SELECTED,
                    "shadow-[inset_0_0_0_2px_#6965db] dark:shadow-[inset_0_0_0_2px_#a8a5ff]"
                )
        )}
    >
        {item.kind === "more" ? (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-zinc-500 dark:text-zinc-400">
                <span className="text-[13px] font-bold leading-none">
                    {item.count ? `+${compactNumber(item.count)}` : "All"}
                </span>
                <ChevronRight className="h-3.5 w-3.5" />
            </span>
        ) : (
            // A definite box, so tall and wide icons shrink into it instead of stretching it
            <span className="absolute inset-[22%] flex items-center justify-center">
                {item.kind === "element" ? <ElementSketch type={item.shape.type} /> : null}
                {item.kind === "icon" ? (
                    <IconImage
                        set={item.set}
                        name={item.name}
                        className="h-full min-h-0 w-full min-w-0"
                    />
                ) : null}
            </span>
        )}
    </div>
);

const LoadingTiles = () => (
    <div className="grid grid-cols-10 gap-1.5 px-1">
        {Array.from({ length: 10 }, (_, i) => (
            <span
                key={i}
                className="aspect-square animate-pulse rounded-lg bg-black/[0.04] dark:bg-white/[0.05]"
            />
        ))}
    </div>
);

const Chip = ({
    isActive,
    onClick,
    children,
}: {
    isActive: boolean;
    onClick: () => void;
    children: ReactNode;
}) => (
    <button
        type="button"
        tabIndex={-1}
        onMouseDown={event => event.preventDefault()}
        onClick={onClick}
        className={cn(
            "flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium transition-colors",
            isActive
                ? "bg-[#1b1b1f] text-white dark:bg-white dark:text-[#1b1b1f]"
                : "text-zinc-500 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] hover:text-[#1b1b1f] dark:text-zinc-400 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] dark:hover:text-white"
        )}
    >
        {children}
    </button>
);

/** Picks a kind, and in Icons a set */
const ScopeChips = ({ scope, onSelect }: { scope: Scope; onSelect: (scope: Scope) => void }) => (
    <div className="flex shrink-0 flex-col gap-2 border-b border-black/[0.07] px-3.5 py-2.5 dark:border-white/[0.07]">
        <div className="flex items-center gap-1.5">
            {KINDS.map(kind => (
                <Chip
                    key={kind.label}
                    isActive={kind.scope.kind === scope.kind}
                    onClick={() => onSelect(kind.scope)}
                >
                    {kind.label}
                </Chip>
            ))}
        </div>
        {scope.kind === "icons" ? (
            <div className="flex flex-wrap items-center gap-1.5">
                {ICON_SETS.map(set => (
                    <Chip
                        key={set.id}
                        isActive={scope.set === set.id}
                        onClick={() => onSelect({ kind: "icons", set: set.id })}
                    >
                        <IconImage set={set.id} name={set.sample} className="h-3.5 w-3.5" />
                        {set.label}
                    </Chip>
                ))}
            </div>
        ) : null}
    </div>
);

const isMermaid = (item: Item) => item.kind === "element" && item.shape.type === "mermaid";
const isLinkCard = (item: Item) => item.kind === "element" && item.shape.type === "link";
// Written in their own dialog first, so they're added one at a time
const hasDialog = (item: Item) => isMermaid(item) || isLinkCard(item);

type FooterProps = { current?: Item; canGoBack: boolean };

/** What's selected, and what the keys do with it */
const Footer = ({ current, canGoBack }: FooterProps) => {
    const isInsertable = current !== undefined && !isOpener(current);
    const canAddMore = isInsertable && current !== undefined && !hasDialog(current);

    return (
        <div className="hidden h-[42px] shrink-0 items-center gap-4 border-t border-black/[0.07] bg-black/[0.02] px-4 text-[12.5px] text-zinc-500 dark:border-white/[0.07] dark:bg-white/[0.02] dark:text-zinc-400 sm:flex">
            <span className="flex min-w-0 flex-1 items-center gap-2">
                {current ? (
                    <>
                        <span className="truncate font-semibold text-[#1b1b1f] dark:text-[#ececf1]">
                            {getItemTitle(current)}
                        </span>
                        <span className="truncate">{getItemDescription(current)}</span>
                    </>
                ) : null}
            </span>
            <Hint keys={["↵"]}>{isInsertable ? "Add" : "Open"}</Hint>
            {canAddMore ? <Hint keys={["⇧", "↵"]}>Add more</Hint> : null}
            {canGoBack ? <Hint keys={["esc"]}>Back</Hint> : null}
        </div>
    );
};

type Visit = { scope: Scope; query: string; selected: number; renderLimit: number };

type Props = {
    /** Where the mouse was when the palette opened, to add things there */
    pointer?: ClientPoint;
    onClose: () => void;
};

/** Search and add shapes, blocks and icons: all at once, or one kind, set or category */
export const AddElementPalette = ({ pointer, onClose }: Props) => {
    const startPointer = useRef(pointer).current;
    const [scope, setScope] = useState<Scope>(ALL_SCOPE);
    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState(0);
    const [renderLimit, setRenderLimit] = useState(RENDER_STEP);
    const list = useRef<HTMLDivElement>(null);
    const end = useRef<HTMLDivElement>(null);
    // What was added last while the palette stays open, so the next one goes beside it
    const lastAdded = useRef<Placement>();
    // Where each level was left, so going back returns to the same row
    const visits = useRef<Visit[]>([]);
    // The level just left without a visit, to select the way into it
    const cameFrom = useRef<Scope>();

    const { getStartPlacement, insert } = useInsertElement();
    // As they were on opening, so adding something doesn't move what's shown
    const recentKeys = useRef(useRecentElementsStore.getState().recents).current;
    const addRecent = useRecentElementsStore(s => s.addRecent);

    const trimmed = query.trim();
    const debouncedQuery = useDebounce(trimmed, 250);
    const openSet = scope.kind === "icons" ? scope.set : undefined;
    const localIcons = useIconCollectionsQuery(LOCAL_SETS);
    const collection = useIconCollectionQuery(openSet);
    const searchedSets = getSearchedSets(scope, collection !== undefined);
    const search = useIconSearchQuery(debouncedQuery, searchedSets);
    const isSearching =
        searchedSets.length > 0 &&
        trimmed.length > 0 &&
        (search.isFetching || trimmed !== debouncedQuery);

    const recents = useMemo(
        () => recentKeys.map(parseItemKey).filter(item => item !== undefined),
        [recentKeys]
    );
    const allSections = useMemo(
        () =>
            getSections({
                scope,
                query: trimmed,
                recents,
                // Results for an older query are hidden, rather than shown against the new one
                searchResults: trimmed === debouncedQuery ? search.data : [],
                isSearching,
                localIcons,
                collection,
            }),
        [scope, trimmed, debouncedQuery, recents, search.data, isSearching, localIcons, collection]
    );
    const totalItems = allSections.reduce((sum, section) => sum + section.items.length, 0);
    const sections = useMemo(
        () => limitSections(allSections, renderLimit),
        [allSections, renderLimit]
    );
    const items = sections.flatMap(section => section.items);
    const index = Math.min(selected, Math.max(items.length - 1, 0));
    const current = items[index];
    const parent = getParentScope(scope);
    const canGoBack = visits.current.length > 0 || parent !== undefined;

    useEffect(() => {
        list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
    }, [index, sections]);

    useEffect(() => {
        const from = cameFrom.current;
        if (!from) return;
        cameFrom.current = undefined;
        const way = items.findIndex(item => isOpener(item) && isSameScope(item.scope, from));
        if (way >= 0) setSelected(way);
    }, [items]);

    // Shows more of a large set when scrolled near the end
    useEffect(() => {
        if (!end.current || totalItems <= renderLimit) return;
        const observer = new IntersectionObserver(
            ([entry]) => entry?.isIntersecting && setRenderLimit(limit => limit + RENDER_STEP),
            { root: list.current, rootMargin: "400px" }
        );
        observer.observe(end.current);
        return () => observer.disconnect();
    }, [totalItems, renderLimit]);

    const goTo = (next: Scope, nextQuery = query) => {
        setScope(next);
        setQuery(nextQuery);
        setSelected(0);
        setRenderLimit(RENDER_STEP);
        list.current?.scrollTo({ top: 0 });
    };

    const open = (item: BrowseItem | MoreItem) => {
        visits.current.push({ scope, query, selected: index, renderLimit });
        goTo(item.scope, item.kind === "more" && item.keepQuery ? query : "");
    };

    /** Back where this level was opened from, on the same row, or else one level up */
    const goBack = () => {
        const visit = visits.current.pop();
        if (visit) {
            setScope(visit.scope);
            setQuery(visit.query);
            setSelected(visit.selected);
            setRenderLimit(visit.renderLimit);
            return;
        }

        if (!parent) return;
        // Got here with a chip: select the way into it, if the level up has one
        cameFrom.current = scope;
        goTo(parent);
    };

    const placeNextAfter = (bounds: Bounds) => {
        lastAdded.current = { after: bounds };
    };

    const add = async (item: Item, keepOpen: boolean) => {
        if (isOpener(item)) {
            open(item);
            return;
        }

        const placement = lastAdded.current ?? getStartPlacement(startPointer);
        if (!placement) return;

        // A diagram or link is written first, in its own dialog
        if (hasDialog(item)) {
            addRecent(getItemKey(item));
            onClose();
            if (isMermaid(item))
                useMermaidDialogStore.getState().open({ kind: "insert", placement });
            else useLinkCardStore.getState().open({ kind: "insert", placement });
            return;
        }

        try {
            const added = await insert(item, placement);
            if (!added) return;
            addRecent(getItemKey(item));

            if (keepOpen) {
                placeNextAfter(added.bounds);
                return;
            }

            onClose();
            // A new code block is for typing code in
            if (added.codeBlock) {
                useCodeEditorStore.getState().setEditingElementId(added.codeBlock.id);
            }
            if (added.markdownNote) {
                useMarkdownNoteStore.getState().setEditingId(added.markdownNote.id);
            }
            if (added.table) {
                useTableStore.getState().setEditing({ id: added.table.id, row: 0, column: 0 });
            }
            if (added.chart) useChartStore.getState().setEditingId(added.chart.id);
        } catch {
            toast.error(`Couldn't add ${getItemTitle(item)}`);
        }
    };

    /** What each key does. Returns false to leave the key to the field. */
    const keyActions: Record<string, (event: KeyboardEvent<HTMLInputElement>) => boolean> = {
        Enter: event => {
            if (current) void add(current, event.shiftKey);
            return true;
        },
        // The next or previous one, in reading order through rows and grids
        Tab: event => {
            if (items.length > 0) {
                setSelected((index + (event.shiftKey ? -1 : 1) + items.length) % items.length);
            }
            return true;
        },
        Backspace: () => {
            if (query || !canGoBack) return false;
            goBack();
            return true;
        },
        Escape: () => {
            if (canGoBack) goBack();
            else onClose();
            return true;
        },
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        // Keep Excalidraw's shortcuts out of the field
        event.stopPropagation();

        const direction = ARROWS[event.key];
        if (direction) {
            const next = moveSelection(sections, index, direction);
            if (next === undefined) return;
            setSelected(next);
            event.preventDefault();
            return;
        }

        if (keyActions[event.key]?.(event)) event.preventDefault();
    };

    const renderSection = (section: Section, start: number) => {
        const props = (item: Item, offset: number) => ({
            item,
            isSelected: start + offset === index,
            onHover: () => setSelected(start + offset),
            onClick: (event: MouseEvent) => void add(item, event.shiftKey),
        });

        return (
            <div key={section.id} role="group" aria-label={section.title} className="pb-1">
                <div className="flex h-9 items-center px-2.5 pt-2 text-[11px] font-bold uppercase tracking-[0.07em] text-zinc-400">
                    {section.title}
                </div>
                {section.items.length === 0 && section.loading ? <LoadingTiles /> : null}
                {section.layout === "rows"
                    ? section.items.map((item, offset) => (
                          <Row {...props(item, offset)} key={getItemKey(item)} query={trimmed} />
                      ))
                    : null}
                {section.layout === "grid" ? (
                    <div className="grid grid-cols-10 gap-1.5 px-1">
                        {section.items.map((item, offset) => (
                            <Tile {...props(item, offset)} key={getItemKey(item)} />
                        ))}
                    </div>
                ) : null}
                {section.layout === "tiles" ? (
                    <div className="grid grid-cols-7 gap-1.5 px-1">
                        {section.items.map((item, offset) =>
                            item.kind === "element" ? (
                                <ShapeTile
                                    {...props(item, offset)}
                                    key={getItemKey(item)}
                                    shape={item.shape}
                                    query={trimmed}
                                />
                            ) : null
                        )}
                    </div>
                ) : null}
            </div>
        );
    };

    const renderList = () => {
        if (sections.length === 0) {
            return (
                <div className="flex flex-col items-center gap-4 px-6 py-14 text-center text-sm text-zinc-400">
                    {trimmed
                        ? `Nothing in ${getScopeLabel(scope)} matches "${trimmed}"`
                        : "Nothing here yet"}
                    {scope.kind !== "all" && trimmed ? (
                        <button
                            type="button"
                            onMouseDown={event => event.preventDefault()}
                            onClick={() => goTo(ALL_SCOPE)}
                            className="flex h-9 items-center gap-2 rounded-lg bg-[#1b1b1f] px-3.5 font-semibold text-white dark:bg-white dark:text-[#111]"
                        >
                            Search everything
                        </button>
                    ) : null}
                </div>
            );
        }

        let start = 0;
        return sections.map(section => {
            const rendered = renderSection(section, start);
            start += section.items.length;
            return rendered;
        });
    };

    const path = getScopePath(scope);

    return (
        <Modal.Container
            show
            setShow={onClose}
            backgroundClassName="justify-start px-4 pt-[12vh] bg-opacity-20 dark:bg-opacity-50"
        >
            <div
                role="dialog"
                aria-modal
                aria-label="Add an element"
                {...{ [PALETTE_ATTRIBUTE]: "" }}
                className="flex h-[min(560px,76vh)] w-full max-w-[680px] flex-col overflow-hidden rounded-2xl bg-white text-[#1b1b1f] shadow-[0_30px_70px_-24px_rgba(25,25,60,0.45),0_0_0_1px_rgba(20,20,40,0.07)] duration-200 animate-in fade-in-0 zoom-in-[0.98] slide-in-from-top-2 dark:bg-[#1d1d23] dark:text-[#ececf1] dark:shadow-[0_30px_70px_-24px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.07)] dark:[color-scheme:dark]"
            >
                <label className="flex h-[60px] shrink-0 items-center gap-2 border-b border-black/[0.07] px-4 text-zinc-400 dark:border-white/[0.07]">
                    <Search className="mr-0.5 h-5 w-5 shrink-0" />
                    {path.map((step, i) => (
                        <span key={step.label} className="flex shrink-0 items-center gap-2">
                            {i > 0 ? <ChevronRight className="h-3.5 w-3.5" /> : null}
                            <button
                                type="button"
                                tabIndex={-1}
                                onMouseDown={event => event.preventDefault()}
                                onClick={() => goTo(step.scope)}
                                className="rounded-md bg-[#fdf0dc] px-2 py-1 text-[13px] font-bold text-[#9a5512] dark:bg-[#3a2a14] dark:text-[#f0a650]"
                            >
                                {step.label}
                            </button>
                        </span>
                    ))}
                    <input
                        autoFocus
                        value={query}
                        onChange={event => {
                            setQuery(event.target.value);
                            setSelected(0);
                            setRenderLimit(RENDER_STEP);
                        }}
                        onKeyDown={onKeyDown}
                        placeholder={
                            scope.kind === "all"
                                ? "Search shapes, blocks and icons"
                                : `Search ${getScopeLabel(scope).toLowerCase()}`
                        }
                        role="combobox"
                        aria-expanded
                        aria-controls="add-element-list"
                        autoComplete="off"
                        spellCheck={false}
                        className="ml-1 min-w-0 flex-1 bg-transparent text-lg text-[#1b1b1f] outline-none placeholder:text-zinc-400 dark:text-[#ececf1]"
                    />
                    <Keys keys={["esc"]} />
                </label>

                <ScopeChips scope={scope} onSelect={goTo} />

                <div
                    ref={list}
                    id="add-element-list"
                    role="listbox"
                    className="min-h-0 flex-1 overflow-y-auto px-2 pb-2"
                >
                    {renderList()}
                    <div ref={end} />
                </div>

                <Footer current={current} canGoBack={canGoBack} />
            </div>
        </Modal.Container>
    );
};
