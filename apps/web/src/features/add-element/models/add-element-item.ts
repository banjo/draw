import { Shape, ShapeKind, shapes } from "@/models/shapes";
import { getFlagName } from "./flag-names";
import { getIconSet, IconSetId, isIconSetId } from "./icon-sets";

/** Where in the palette you are: everything, one kind, an icon set, or a part of one */
export type Scope =
    { kind: "all" } | { kind: ShapeKind } | { kind: "icons"; set?: IconSetId; category?: string };

export const ALL_SCOPE: Scope = { kind: "all" };

export type ElementItem = { kind: "element"; shape: Shape };
export type IconItem = { kind: "icon"; set: IconSetId; name: string };
/** A row that opens a part of the palette instead of adding something */
export type BrowseItem = {
    kind: "browse";
    scope: Scope;
    title: string;
    description: string;
    icon: { set: IconSetId; name: string };
};
/** The last tile of a preview, which shows the rest of it */
export type MoreItem = {
    kind: "more";
    scope: Scope;
    /** How many more, when known */
    count?: number;
    keepQuery: boolean;
};
/** Opens the AI dialog with what was typed */
export type AiItem = { kind: "ai"; mode: "diagram" | "mermaid"; prompt: string };
export type Item = ElementItem | IconItem | BrowseItem | MoreItem | AiItem;

/** Opens a part of the palette, rather than adding something */
export const isOpener = (item: Item): item is BrowseItem | MoreItem =>
    item.kind === "browse" || item.kind === "more";

export const isSameScope = (a: Scope, b: Scope) =>
    a.kind === b.kind &&
    (a.kind !== "icons" || (b.kind === "icons" && a.set === b.set && a.category === b.category));

/** One level up: a category's set, a set's icons, or everything */
export const getParentScope = (scope: Scope): Scope | undefined => {
    if (scope.kind === "all") return undefined;
    if (scope.kind !== "icons") return ALL_SCOPE;
    if (scope.category) return { kind: "icons", set: scope.set };
    if (scope.set) return { kind: "icons" };
    return ALL_SCOPE;
};

const KIND_LABELS: Record<Scope["kind"], string> = {
    all: "All",
    shape: "Shapes",
    block: "Blocks",
    icons: "Icons",
};

/** The steps down to the scope, as shown in the search field: Icons › Emojis › Animals */
export const getScopePath = (scope: Scope): { label: string; scope: Scope }[] => {
    if (scope.kind === "all") return [];
    if (scope.kind !== "icons") return [{ label: KIND_LABELS[scope.kind], scope }];

    const path = [{ label: "Icons", scope: { kind: "icons" } as Scope }];
    if (scope.set) {
        path.push({ label: getIconSet(scope.set).label, scope: { kind: "icons", set: scope.set } });
    }
    if (scope.set && scope.category) path.push({ label: scope.category, scope });
    return path;
};

export const getScopeLabel = (scope: Scope) => getScopePath(scope).at(-1)?.label ?? "All";

export const getItemKey = (item: Item): string => {
    if (item.kind === "element") return `element:${item.shape.type}`;
    if (item.kind === "icon") return `icon:${item.set}:${item.name}`;
    if (item.kind === "ai") return `ai:${item.mode}`;
    const path = getScopePath(item.scope)
        .map(step => step.label)
        .join("/");
    return `${item.kind}:${path}`;
};

/** The item a key from getItemKey stands for, if it still exists */
export const parseItemKey = (key: string): ElementItem | IconItem | undefined => {
    const [kind, first, ...rest] = key.split(":");
    if (kind === "element") {
        const shape = shapes.find(({ type }) => type === first);
        return shape ? { kind: "element", shape } : undefined;
    }

    const name = rest.join(":");
    if (kind === "icon" && first && isIconSetId(first) && name) {
        return { kind: "icon", set: first, name };
    }
    return undefined;
};

export const getItemTitle = (item: Item) => {
    if (item.kind === "element") return item.shape.title ?? item.shape.type;
    if (item.kind === "browse") return item.title;
    if (item.kind === "ai") {
        return item.mode === "diagram" ? "Create a diagram" : "Create a Mermaid diagram";
    }
    if (item.kind === "more")
        return item.count ? `${item.count.toLocaleString()} more` : "Show all";
    const set = getIconSet(item.set);
    if (set.countryCodes) return getFlagName(item.name);
    return (set.displayName?.(item.name) ?? item.name).replaceAll("-", " ");
};

export const getItemDescription = (item: Item) => {
    if (item.kind === "element") return item.shape.description ?? "";
    if (item.kind === "browse") return item.description;
    if (item.kind === "ai") return `“${item.prompt}”`;
    if (item.kind === "more") return `in ${getScopeLabel(item.scope)}`;
    return getIconSet(item.set).label;
};
