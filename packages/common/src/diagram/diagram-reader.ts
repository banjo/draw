import {
    DIAGRAM_COLORS,
    DiagramColor,
    DiagramEdge,
    DiagramGroup,
    DiagramNode,
    DiagramShape,
    DiagramSpec,
} from "../model/ai";
import { CustomData } from "../model/excalidraw-custom-data";
import { ExcalidrawElement, ExcalidrawTextElement } from "../model/excalidraw-element";
import { BlockContent, NOTE_WIDTHS } from "./blocks";
import { FILLS } from "./diagram-builder";
import { ElementBounds } from "./element-bounds";
import { Box, Point } from "./element-factory";

export type DiagramSelection = {
    /** What's selected, as a diagram, when there are shapes or blocks in it */
    spec: DiagramSpec | undefined;
    /** A Mermaid block selected on its own */
    mermaid: { id: string; definition: string } | undefined;
    /** Where each node was, to keep it there */
    positions: Map<string, Point>;
    /** Where each node is, and how big */
    boxes: Map<string, Box>;
    /** The elements the result takes the place of */
    replaces: string[];
    /** Which node each shape or block became, to connect arrows from outside to it again */
    nodeOf: Map<string, string>;
    /** The arrow each edge is, by its place in the spec's edges */
    arrowOf: string[];
    /** The frame each group is */
    frameOf: Map<string, string>;
    /** The frame everything selected is in, which the result goes in too */
    frameId: string | undefined;
    /** Where the selection was: its top left corner */
    origin: Point;
    /** How many selected things a diagram can't hold, like drawings and images */
    skipped: number;
    /** What's selected, in a few words */
    summary: string;
};

type ReadOptions = {
    /**
     * "readable" makes ids from labels, which an AI follows more easily. "element" uses the
     * elements' own ids, to change them later.
     */
    ids?: "readable" | "element";
};

const STICKY_FILL = "#ffec99";

const SHAPE_TYPES: Record<string, DiagramShape> = {
    circle: "circle",
    pill: "pill",
    hexagon: "hexagon",
    parallelogram: "parallelogram",
    cylinder: "cylinder",
    document: "document",
    cloud: "cloud",
    triangle: "triangle",
    star: "star",
};

const MODEL_TYPES = new Set(["model", "model-child", "model-line", "model-title"]);

const isImage = (element: ExcalidrawElement) => element.type === "image";
const isText = (element: ExcalidrawElement): element is ExcalidrawTextElement =>
    element.type === "text";
const typeOf = (element: ExcalidrawElement) => element.customData?.type;
const isMermaid = (element: ExcalidrawElement) => isImage(element) && typeOf(element) === "mermaid";
const isSwimlane = (element: ExcalidrawElement) =>
    element.type === "frame" && typeOf(element) === "swimlane";
const isSwimlanePart = (element: ExcalidrawElement) => typeOf(element) === "swimlane-part";

const toRgb = (hex: string) => {
    const value = parseInt(hex.replace("#", "").slice(0, 6), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255] as const;
};

/** The diagram color closest to a fill, or none for no fill */
export const toDiagramColor = (fill: string): DiagramColor | undefined => {
    if (!/^#[0-9a-f]{6}/i.test(fill)) return undefined;
    const [r, g, b] = toRgb(fill);
    let best: DiagramColor | undefined;
    let distance = Infinity;
    DIAGRAM_COLORS.forEach(color => {
        const [cr, cg, cb] = toRgb(FILLS[color]);
        const d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
        if (d < distance) {
            distance = d;
            best = color;
        }
    });
    return best;
};

const slug = (text: string) =>
    text
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 24);

/** A node with the content of a shape or block, without its id and group */
export type NodeContent = DiagramNode extends infer N
    ? N extends DiagramNode
        ? Omit<N, "id" | "group">
        : never
    : never;

const getTextSize = (fontSize: number) => {
    if (fontSize <= 16) return "small";
    return fontSize >= 28 ? "large" : "medium";
};

const getHeads = (start: unknown, end: unknown) => {
    if (start && end) return "both";
    return !start && !end ? "none" : undefined;
};

/** What a shape or block is, as a node, or undefined if a diagram can't hold it */
export const readNode = (
    element: ExcalidrawElement,
    label: string | undefined
): NodeContent | undefined => {
    const type = typeOf(element);

    if (isImage(element)) {
        if (type === "markdown") {
            const { markdown, width } = BlockContent.note(element);
            const sizes = ["S", "M", "L"] as const;
            const size = sizes.find(name => width <= NOTE_WIDTHS[name]) ?? "L";
            return { type: "note", markdown, width: size };
        }
        if (type === "table") {
            const { rows, headerRow, headerColumn } = BlockContent.table(element);
            return { type: "table", rows, headerRow, headerColumn };
        }
        if (type === "chart") {
            const { rows, chartType, title } = BlockContent.chart(element);
            return { type: "chart", rows, chartType, title: title || undefined };
        }
        if (type === "codeblock") {
            const { code, language } = BlockContent.code(element);
            return { type: "code", code, language };
        }
        if (type === "link") {
            return { type: "link", url: BlockContent.link(element).url };
        }
        return undefined;
    }

    if (isText(element)) {
        const size = getTextSize(element.fontSize);
        return { type: "text", text: element.originalText ?? element.text, size };
    }

    if (element.type !== "rectangle" && element.type !== "ellipse" && element.type !== "diamond") {
        return undefined;
    }
    if (type && MODEL_TYPES.has(type)) return undefined;

    const fill = element.backgroundColor;
    if (type === "sticky-note") {
        const color = fill.toLowerCase() === STICKY_FILL ? undefined : toDiagramColor(fill);
        return { type: "sticky", text: label ?? "", ...(color ? { color } : {}) };
    }

    const shape: DiagramShape =
        (type && SHAPE_TYPES[type]) ??
        (element.type === "rectangle" && element.roundness ? "rounded" : element.type);
    const color = toDiagramColor(fill);
    return {
        type: "shape",
        shape,
        ...(label ? { label } : {}),
        ...(color ? { color } : {}),
    };
};

/** The text of a shape's or an arrow's label */
export const getLabel = (
    element: ExcalidrawElement,
    byId: Map<string, ExcalidrawElement>
): string | undefined => {
    const text = element.boundElements?.find(bound => bound.type === "text");
    const textElement = text ? byId.get(text.id) : undefined;
    return textElement && isText(textElement) && !textElement.isDeleted
        ? (textElement.originalText ?? textElement.text)
        : undefined;
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

type Arrow = ExcalidrawElement & {
    startBinding?: { elementId: string } | null;
    endBinding?: { elementId: string } | null;
    startArrowhead?: string | null;
    endArrowhead?: string | null;
};

/** An arrow between two nodes as an edge, or undefined if it isn't bound to two of them */
export const readEdge = (
    element: ExcalidrawElement,
    nodeIds: Map<string, string>,
    byId: Map<string, ExcalidrawElement>
): DiagramEdge | undefined => {
    const arrow = element as Arrow;
    const from = arrow.startBinding && nodeIds.get(arrow.startBinding.elementId);
    const to = arrow.endBinding && nodeIds.get(arrow.endBinding.elementId);
    if (!from || !to) return undefined;
    const label = getLabel(element, byId);
    const heads = getHeads(arrow.startArrowhead, arrow.endArrowhead);
    const isForward = Boolean(arrow.endArrowhead) || !arrow.startArrowhead;
    return {
        from: isForward ? from : to,
        to: isForward ? to : from,
        ...(label ? { label } : {}),
        ...(element.strokeStyle !== "solid" ? { style: element.strokeStyle } : {}),
        ...(heads ? { heads } : {}),
    };
};

/**
 * What's selected, as a diagram. Bound text goes with its shape, a frame brings what's in it,
 * and arrows between selected things come along. What a diagram can't hold, like drawings and
 * images, is left out and stays where it is.
 */
const read = (
    selected: readonly ExcalidrawElement[],
    scene: readonly ExcalidrawElement[],
    options: ReadOptions = {}
): DiagramSelection => {
    const isReadable = options.ids !== "element";
    const byId = new Map(scene.map(element => [element.id, element]));
    const ids = new Set(selected.map(element => element.id));

    // A selected frame brings what's in it
    scene.forEach(element => {
        if (element.frameId && ids.has(element.frameId)) ids.add(element.id);
    });

    const elements = scene.filter(element => ids.has(element.id) && !element.isDeleted);

    const mermaidBlocks = elements.filter(isMermaid);
    const frames = elements.filter(element => element.type === "frame" && !isSwimlane(element));

    const used = new Set<string>();
    const makeId = (element: ExcalidrawElement, base: string, fallback: string) => {
        if (!isReadable) return element.id;
        let id = slug(base) || fallback;
        for (let i = 2; used.has(id); i++) id = `${slug(base) || fallback}-${i}`;
        used.add(id);
        return id;
    };

    const groups: DiagramGroup[] = [];
    const groupIds = new Map<string, string>();
    const frameOf = new Map<string, string>();
    frames.forEach((frame, i) => {
        const label = (frame as { name?: string | null }).name ?? `Group ${i + 1}`;
        const id = makeId(frame, label, `group-${i + 1}`);
        groups.push({ id, label });
        groupIds.set(frame.id, id);
        frameOf.set(id, frame.id);
    });

    const nodes: DiagramNode[] = [];
    const nodeIds = new Map<string, string>();
    const positions = new Map<string, Point>();
    const boxes = new Map<string, Box>();
    const replaces = new Set<string>(frames.map(frame => frame.id));
    let skipped = 0;

    elements.forEach(element => {
        if (isSwimlanePart(element)) return;
        if (isSwimlane(element)) skipped += 1;
        if (element.type === "frame" || element.type === "arrow") return;
        // Text on a shape or an arrow is part of it
        if (isText(element) && element.containerId) return;
        if (isMermaid(element)) return;

        const content = readNode(element, getLabel(element, byId));
        if (!content) {
            skipped += 1;
            return;
        }
        const label = ("label" in content && content.label) || ("text" in content && content.text);
        const id = makeId(element, label || "", `${content.type}-${nodes.length + 1}`);
        const group = element.frameId ? groupIds.get(element.frameId) : undefined;
        nodes.push({ ...content, id, ...(group ? { group } : {}) } as DiagramNode);
        nodeIds.set(element.id, id);
        positions.set(id, { x: element.x, y: element.y });
        boxes.set(id, ElementBounds.getBox(element));
        replaces.add(element.id);
        element.boundElements?.forEach(bound => bound.type === "text" && replaces.add(bound.id));
    });

    // Arrows from and to selected things, selected or not
    const edges: DiagramEdge[] = [];
    const arrowOf: string[] = [];
    scene.forEach(element => {
        if (element.type !== "arrow" || element.isDeleted) return;
        const edge = readEdge(element, nodeIds, byId);
        if (!edge) {
            if (ids.has(element.id)) skipped += 1;
            return;
        }
        edges.push(edge);
        arrowOf.push(element.id);
        replaces.add(element.id);
        element.boundElements?.forEach(bound => bound.type === "text" && replaces.add(bound.id));
    });

    // Mostly side by side, or mostly above each other
    const centers = new Map(
        elements.map(element => [
            nodeIds.get(element.id),
            { x: element.x + element.width / 2, y: element.y + element.height / 2 },
        ])
    );
    const spread = edges.reduce(
        (sum, edge) => {
            const a = centers.get(edge.from);
            const b = centers.get(edge.to);
            if (!a || !b) return sum;
            return { x: sum.x + Math.abs(b.x - a.x), y: sum.y + Math.abs(b.y - a.y) };
        },
        { x: 0, y: 0 }
    );

    const mermaid =
        nodes.length === 0 && mermaidBlocks.length === 1
            ? {
                  id: mermaidBlocks[0]!.id,
                  definition: CustomData.getMermaidDefinition(mermaidBlocks[0]!.customData) ?? "",
              }
            : undefined;
    if (mermaid) replaces.add(mermaid.id);
    else skipped += mermaidBlocks.length;

    const replaced = scene.filter(element => replaces.has(element.id));
    const [minX, minY] = replaced.length ? ElementBounds.getCommonBounds(replaced) : [0, 0];

    const spec: DiagramSpec | undefined =
        nodes.length > 0
            ? {
                  direction: spread.y > spread.x ? "down" : "right",
                  groups: groups.filter(group => nodes.some(node => node.group === group.id)),
                  nodes,
                  edges,
              }
            : undefined;

    const parts = [
        mermaid ? "a Mermaid diagram" : undefined,
        nodes.length
            ? plural(nodes.length, "shape or block").replace("shape or blocks", "shapes and blocks")
            : undefined,
        edges.length ? plural(edges.length, "arrow") : undefined,
    ].filter(Boolean);

    const frameIds = new Set(replaced.map(element => element.frameId ?? undefined));
    const [frameId] = frameIds;
    const isInOneFrame = frameIds.size === 1 && frameId !== undefined && !replaces.has(frameId);

    return {
        spec,
        mermaid,
        positions,
        boxes,
        replaces: [...replaces],
        nodeOf: nodeIds,
        arrowOf,
        frameOf,
        frameId: isInOneFrame ? frameId : undefined,
        origin: { x: minX, y: minY },
        skipped,
        summary: parts.join(", "),
    };
};

export const DiagramReader = { read, readNode, readEdge, getLabel };
