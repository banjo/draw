import { shapes } from "@/models/shapes";
import fuzzysort from "fuzzysort";
import {
    BrowseItem,
    ElementItem,
    getItemTitle,
    IconItem,
    Item,
    MoreItem,
    Scope,
} from "./add-element-item";
import { getFlagTags } from "./flag-names";
import { getIconSet, ICON_SETS, IconCollection, IconSet, IconSetId } from "./icon-sets";

/** Icons per row in the palette's grids */
const GRID_COLUMNS = 10;
/** Icons shown in a preview of a set or category, before "Show all" */
const PREVIEW_COUNT = GRID_COLUMNS * 2;
const RECENT_COUNT = GRID_COLUMNS;
const SEARCH_LIMIT = 400;

export type Section = {
    id: string;
    title: string;
    layout: "rows" | "grid";
    items: Item[];
    /** Where Tab and "Show all" go from here */
    scope?: Scope;
    /** Keep the search when going there, as it shows more of the same results */
    keepQuery?: boolean;
    /** How many more there are than shown, or true when not known yet. Shown as a last tile. */
    more?: number | boolean;
    loading?: boolean;
};

type SectionInput = {
    scope: Scope;
    query: string;
    recents: Item[];
    /** Iconify's results for the query, in the sets it searches */
    searchResults: IconItem[];
    isSearching: boolean;
    /** Every flag, searched here as Iconify doesn't know them by country name */
    localIcons?: IconItem[];
    /** The open set's icons, when a set is open */
    collection?: IconCollection;
};

const ELEMENTS: ElementItem[] = shapes.map(shape => ({ kind: "element", shape }));

const toIcon = (set: IconSetId) => (name: string) => ({ kind: "icon", set, name }) as IconItem;

const searchElements = (query: string, kind?: ElementItem["shape"]["kind"]) => {
    const elements = ELEMENTS.filter(item => !kind || item.shape.kind === kind);
    if (!query) return elements;

    return fuzzysort
        .go(query, elements, {
            keys: [item => item.shape.title ?? "", item => item.shape.tags.join(" ")],
            threshold: 0.5,
        })
        .map(result => result.obj);
};

/** The icons in a set matching the query, best first */
const searchIcons = (query: string, icons: IconItem[]) =>
    fuzzysort
        .go(query, icons, {
            keys: [
                item => getItemTitle(item),
                item =>
                    (getIconSet(item.set).countryCodes
                        ? [item.name, ...getFlagTags(item.name)]
                        : []
                    ).join(" "),
            ],
            threshold: 0.5,
            limit: SEARCH_LIMIT,
        })
        .map(result => result.obj);

const browseSet = (set: IconSet): BrowseItem => ({
    kind: "browse",
    scope: { kind: "icons", set: set.id },
    title: set.label,
    description: set.description,
    icon: { set: set.id, name: set.sample },
});

const setMatches = (set: IconSet, query: string) =>
    [set.label, ...set.tags].some(word => word.toLowerCase().startsWith(query.toLowerCase()));

const rows = (title: string, items: Item[], extra?: Partial<Section>): Section => ({
    id: title,
    title,
    layout: "rows",
    items,
    ...extra,
});

const grid = (title: string, items: Item[], extra?: Partial<Section>): Section => ({
    id: title,
    title,
    layout: "grid",
    items,
    ...extra,
});

/** A few of the icons, with how many more there are */
const preview = (items: IconItem[], total = items.length) => ({
    items: items.slice(0, PREVIEW_COUNT),
    more: Math.max(total - PREVIEW_COUNT, 0),
});

/** The results for a query in every set, flags found here and the rest by Iconify */
const iconResults = (input: SectionInput) => {
    const local = input.localIcons ? searchIcons(input.query, input.localIcons) : [];
    return [...local, ...input.searchResults];
};

/** 0 when the name is the query, then starting with it, then with a word starting with it */
const rankName = (item: IconItem, query: string) => {
    const name = getItemTitle(item).toLowerCase();
    const q = query.toLowerCase();
    if (name === q) return 0;
    if (name.startsWith(q)) return 1;
    if (name.split(" ").some(word => word.startsWith(q))) return 2;
    return 3;
};

/**
 * Takes turns between the sets, so one set's many results don't hide the others, with the
 * closest names first
 */
const mixSets = (icons: IconItem[], query: string) => {
    const bySet = ICON_SETS.map(set => icons.filter(icon => icon.set === set.id));
    const longest = Math.max(0, ...bySet.map(list => list.length));
    const mixed = Array.from({ length: longest }, (_, i) => bySet.flatMap(list => list[i] ?? []));
    return mixed.flat().sort((a, b) => rankName(a, query) - rankName(b, query));
};

const getAllSections = (input: SectionInput): Section[] => {
    const { query, recents } = input;

    if (!query) {
        return [
            grid("Recently used", recents.slice(0, RECENT_COUNT)),
            rows("Shapes", searchElements("", "shape"), { scope: { kind: "shape" } }),
            rows("Blocks", searchElements("", "block"), { scope: { kind: "block" } }),
            rows("Icons", ICON_SETS.map(browseSet), { scope: { kind: "icons" } }),
        ];
    }

    const icons = mixSets(iconResults(input), query);
    const { items, more } = preview(icons);
    return [
        rows("Shapes", searchElements(query, "shape"), {
            scope: { kind: "shape" },
            keepQuery: true,
        }),
        rows("Blocks", searchElements(query, "block"), {
            scope: { kind: "block" },
            keepQuery: true,
        }),
        rows("Browse", ICON_SETS.filter(set => setMatches(set, query)).map(browseSet)),
        grid("Icons", items, {
            scope: { kind: "icons" },
            keepQuery: true,
            more,
            loading: input.isSearching && icons.length === 0,
        }),
    ];
};

const getIconsSections = (input: SectionInput): Section[] => {
    const { query, recents } = input;

    if (!query) {
        return [
            grid(
                "Recently used",
                recents.filter(item => item.kind === "icon").slice(0, RECENT_COUNT)
            ),
            ...ICON_SETS.map(set =>
                grid(set.label, set.popular.slice(0, PREVIEW_COUNT).map(toIcon(set.id)), {
                    scope: { kind: "icons", set: set.id },
                    more: true,
                })
            ),
        ];
    }

    const icons = mixSets(iconResults(input), query);
    return ICON_SETS.map(set => {
        const inSet = icons.filter(icon => icon.set === set.id);
        const { items, more } = preview(inSet);
        return grid(set.label, items, {
            scope: { kind: "icons", set: set.id },
            keepQuery: true,
            more,
            loading: input.isSearching && !set.countryCodes && inSet.length === 0,
        });
    });
};

const getSetSections = (input: SectionInput, setId: IconSetId, category?: string): Section[] => {
    const { query, recents, collection } = input;
    const set = getIconSet(setId);
    const loading = !collection;

    if (category) {
        const names = collection?.categories.find(c => c.title === category)?.names ?? [];
        const icons = names.map(toIcon(setId));
        return [grid(category, query ? searchIcons(query, icons) : icons, { loading })];
    }

    const all = (collection?.names ?? []).map(toIcon(setId));
    // Flags by country name, as their names are codes
    if (set.countryCodes) {
        all.sort((a, b) => getItemTitle(a).localeCompare(getItemTitle(b)));
    }
    if (query) {
        // Iconify's results while the set loads, then the set searched here
        const results = collection
            ? searchIcons(query, all)
            : input.searchResults.filter(icon => icon.set === setId);
        return [grid("Results", results, { loading: loading && results.length === 0 })];
    }

    const sections = [
        grid(
            "Recently used",
            recents
                .filter(item => item.kind === "icon" && item.set === setId)
                .slice(0, RECENT_COUNT)
        ),
        grid("Popular", set.popular.map(toIcon(setId))),
    ];

    if (collection && collection.categories.length > 0) {
        return [
            ...sections,
            ...collection.categories.map(({ title, names }) => {
                const { items, more } = preview(names.map(toIcon(setId)));
                return grid(title, items, {
                    scope: { kind: "icons", set: setId, category: title },
                    more,
                });
            }),
        ];
    }

    return [...sections, grid(`All ${set.label.toLowerCase()}`, all, { loading })];
};

/** Ends a preview with a tile that shows the rest, in place of its last icon */
const withMoreTile = (section: Section): Section => {
    if (!section.scope || !section.more || section.layout !== "grid") return section;

    const shown = section.items.slice(0, PREVIEW_COUNT - 1);
    const hidden = section.items.length - shown.length;
    const more: MoreItem = {
        kind: "more",
        scope: section.scope,
        count: typeof section.more === "number" ? section.more + hidden : undefined,
        keepQuery: section.keepQuery ?? false,
    };
    return { ...section, items: [...shown, more] };
};

/** What the palette shows for a scope and query, in order */
export const getSections = (input: SectionInput): Section[] => {
    const { scope } = input;
    let sections: Section[];

    if (scope.kind === "all") sections = getAllSections(input);
    else if (scope.kind === "icons" && scope.set) {
        sections = getSetSections(input, scope.set, scope.category);
    } else if (scope.kind === "icons") sections = getIconsSections(input);
    else {
        sections = [
            rows(
                scope.kind === "shape" ? "Shapes" : "Blocks",
                searchElements(input.query, scope.kind)
            ),
        ];
    }

    return sections.filter(({ items, loading }) => items.length > 0 || loading).map(withMoreTile);
};

type Position = { section: number; offset: number };

const locate = (sections: Section[], index: number): Position | undefined => {
    let start = 0;
    for (const [section, { items }] of sections.entries()) {
        if (index < start + items.length) return { section, offset: index - start };
        start += items.length;
    }
    return undefined;
};

const startOf = (sections: Section[], section: number) =>
    sections.slice(0, section).reduce((sum, { items }) => sum + items.length, 0);

const columnsOf = (section: Section) => (section.layout === "grid" ? GRID_COLUMNS : 1);

/** The next section with something in it, going up or down */
const nextSection = (sections: Section[], from: number, step: 1 | -1) => {
    for (let i = from + step; i >= 0 && i < sections.length; i += step) {
        if (sections[i]!.items.length > 0) return i;
    }
    return undefined;
};

export type Direction = "up" | "down" | "left" | "right";

/**
 * Moves the selection through rows and grids, like in a list of rows and an emoji picker in
 * one. Left and right only move in grids, so they still move the cursor in the search field
 * on a row. Returns undefined when the key isn't for moving.
 */
export const moveSelection = (
    sections: Section[],
    index: number,
    direction: Direction
): number | undefined => {
    const total = sections.reduce((sum, { items }) => sum + items.length, 0);
    const position = locate(sections, index);
    if (total === 0 || !position) return undefined;

    const section = sections[position.section]!;
    const columns = columnsOf(section);
    const column = position.offset % columns;

    if (direction === "left" || direction === "right") {
        if (section.layout !== "grid") return undefined;
        return Math.min(Math.max(index + (direction === "right" ? 1 : -1), 0), total - 1);
    }

    if (direction === "down") {
        if (position.offset + columns < section.items.length) return index + columns;

        // A shorter last row: its last icon
        const row = Math.floor(position.offset / columns);
        const lastRow = Math.floor((section.items.length - 1) / columns);
        if (row < lastRow) return startOf(sections, position.section) + section.items.length - 1;

        const next = nextSection(sections, position.section, 1);
        if (next === undefined) return 0;
        const target = sections[next]!;
        const offset = target.layout === "grid" ? Math.min(column, target.items.length - 1) : 0;
        return startOf(sections, next) + offset;
    }

    if (position.offset - columns >= 0) return index - columns;

    const previous = nextSection(sections, position.section, -1);
    if (previous === undefined) return total - 1;
    const target = sections[previous]!;
    const targetColumns = columnsOf(target);
    const lastRowStart = Math.floor((target.items.length - 1) / targetColumns) * targetColumns;
    const offset =
        target.layout === "grid"
            ? Math.min(lastRowStart + column, target.items.length - 1)
            : target.items.length - 1;
    return startOf(sections, previous) + offset;
};
