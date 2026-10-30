import { Chart } from "@/features/chart/models/chart";
import { ExcalidrawUtil } from "@/features/draw/utils/excalidraw-util";
import {
    ElementCreationUtil,
    STICKY_NOTE_STYLE,
} from "@/features/draw/utils/element-creation-util";
import { LinkCard } from "@/features/link-card/models/link-card";
import type { LinkContent } from "@/features/link-card/models/link-card-render";
import { MarkdownNote, NOTE_WIDTHS } from "@/features/markdown-note/models/markdown-note";
import {
    CodeBlockContent,
    CodeBlockImage,
} from "@/features/selected-element-visuals/models/code-block-image";
import {
    CODE_EDITOR_LANGUAGES,
    DEFAULT_CODE_EDITOR_FONT_SIZE,
    DEFAULT_CODE_EDITOR_LANGUAGE,
} from "@/features/selected-element-visuals/models/code-editor-langauges";
import { Table } from "@/features/table/models/table";
import dagre from "@dagrejs/dagre";
import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";
import { BinaryFileData } from "@excalidraw/excalidraw/types";
import {
    CustomData,
    CustomElementType,
    DiagramColor,
    DiagramEdge,
    DiagramNode,
    DiagramShape,
    DiagramSpec,
    ExcalidrawElement,
    ExcalidrawElements,
} from "common";

export type Point = { x: number; y: number };
type Box = Point & { width: number; height: number };

/** A node drawn: its elements at 0,0, the one arrows connect to first */
type Drawn = {
    elements: ExcalidrawElement[];
    files: BinaryFileData[];
    width: number;
    height: number;
};

export type BuiltDiagram = {
    elements: ExcalidrawElements;
    files: BinaryFileData[];
    /** Where each node ended up, its top left corner */
    positions: Map<string, Point>;
    /** Whether nodes kept the places they were given, rather than all being laid out */
    isInPlace: boolean;
    /** The element each node is, the one arrows connect to */
    elementOf: Map<string, string>;
};

type Options = {
    /** Where nodes that were on the canvas already were, by id: they stay there */
    positions?: Map<string, Point>;
    /** A link card's title and icon, from the API */
    getLinkContent?: (url: string) => Promise<LinkContent>;
};

/** Excalidraw's lightest shade of each color, as its own fills use */
export const FILLS: Record<DiagramColor, string> = {
    gray: "#e9ecef",
    red: "#ffc9c9",
    pink: "#fcc2d7",
    violet: "#d0bfff",
    blue: "#a5d8ff",
    cyan: "#99e9f2",
    teal: "#96f2d7",
    green: "#b2f2bb",
    yellow: "#ffec99",
    orange: "#ffd8a8",
};

type ShapeLook = {
    type: "rectangle" | "ellipse" | "diamond";
    custom?: CustomElementType;
    isRound?: boolean;
    /** How much bigger than its label it is */
    scale: [number, number];
};

const SHAPES: Record<DiagramShape, ShapeLook> = {
    rectangle: { type: "rectangle", scale: [1, 1] },
    rounded: { type: "rectangle", isRound: true, scale: [1, 1] },
    ellipse: { type: "ellipse", scale: [1.25, 1.3] },
    circle: { type: "ellipse", custom: "circle", scale: [1, 1] },
    diamond: { type: "diamond", scale: [1.5, 1.6] },
    pill: { type: "rectangle", custom: "pill", scale: [1.15, 1] },
    hexagon: { type: "rectangle", custom: "hexagon", scale: [1.3, 1.15] },
    parallelogram: { type: "rectangle", custom: "parallelogram", scale: [1.3, 1] },
    cylinder: { type: "rectangle", custom: "cylinder", scale: [1, 1.6] },
    document: { type: "rectangle", custom: "document", scale: [1, 1.3] },
    cloud: { type: "rectangle", custom: "cloud", scale: [1.4, 1.6] },
    triangle: { type: "rectangle", custom: "triangle", scale: [1.5, 1.9] },
    star: { type: "rectangle", custom: "star", scale: [1.7, 1.9] },
};

const FONT_SIZE = 20;
const TEXT_SIZES = { small: 16, medium: 20, large: 32 } as const;
// Roughly Excalifont's width per character, at FONT_SIZE
const CHAR_WIDTH = 11;
const LINE_HEIGHT = 25;
const GAP = { nodes: 60, ranks: 110 };
const FRAME_PADDING = 40;

/** How big a label is, wrapped at a width that suits a shape */
const measureLabel = (text: string) => {
    const longest = Math.max(...text.split("\n").map(line => line.length), 1);
    const width = Math.min(Math.max(longest * CHAR_WIDTH, 80), 240);
    const lines = text
        .split("\n")
        .reduce((sum, line) => sum + Math.max(1, Math.ceil((line.length * CHAR_WIDTH) / width)), 0);
    return { width, height: lines * LINE_HEIGHT };
};

const fromSkeleton = (skeleton: ExcalidrawElementSkeleton) =>
    convertToExcalidrawElements([skeleton]) as unknown as ExcalidrawElement[];

const drawShape = (node: Extract<DiagramNode, { type: "shape" }>): Drawn => {
    const look = SHAPES[node.shape];
    const label = measureLabel(node.label ?? "");
    let width = Math.max(150, (label.width + 60) * look.scale[0]);
    let height = Math.max(80, (label.height + 50) * look.scale[1]);
    if (node.shape === "circle") width = height = Math.max(width, height, 110);

    const elements = fromSkeleton({
        type: look.type,
        x: 0,
        y: 0,
        width,
        height,
        roundness: look.isRound ? { type: 3 } : null,
        ...(node.color ? { backgroundColor: FILLS[node.color], fillStyle: "solid" } : {}),
        customData: CustomData.createDefault({ shadow: false, type: look.custom ?? look.type }),
        ...(node.label ? { label: { text: node.label, fontSize: FONT_SIZE } } : {}),
    } as ExcalidrawElementSkeleton);
    return { elements, files: [], width, height };
};

const drawSticky = (node: Extract<DiagramNode, { type: "sticky" }>): Drawn => {
    const label = measureLabel(node.text);
    const size = Math.min(Math.max(170, label.height + 80, label.width + 50), 260);
    const elements = fromSkeleton({
        type: "rectangle",
        x: 0,
        y: 0,
        width: size,
        height: size,
        ...STICKY_NOTE_STYLE,
        ...(node.color ? { backgroundColor: FILLS[node.color] } : {}),
        customData: CustomData.createDefault({ shadow: false, type: "sticky-note" }),
        label: { text: node.text, fontSize: FONT_SIZE },
    } as ExcalidrawElementSkeleton);
    return { elements, files: [], width: size, height: size };
};

const drawText = (node: Extract<DiagramNode, { type: "text" }>): Drawn => {
    const elements = fromSkeleton({
        type: "text",
        x: 0,
        y: 0,
        text: node.text,
        fontSize: TEXT_SIZES[node.size ?? "medium"],
        customData: CustomData.createDefault({ shadow: false, type: "text" }),
    });
    const [element] = elements;
    return { elements, files: [], width: element?.width ?? 0, height: element?.height ?? 0 };
};

/** The code block languages are a fixed list: the closest one, by name */
const toLanguage = (language: string) => {
    const name = language.trim().toLowerCase();
    const aliases: Record<string, string> = {
        ts: "TypeScript",
        tsx: "TypeScript",
        js: "JavaScript",
        jsx: "JavaScript",
        py: "Python",
        csharp: "C#",
        cs: "C#",
        cpp: "C++",
        md: "Markdown",
        yaml: "JSON",
        yml: "JSON",
        shell: "Batch",
        bash: "Batch",
        sh: "Batch",
    };
    const match = CODE_EDITOR_LANGUAGES.find(option => option.toLowerCase() === name);
    return match ?? aliases[name] ?? DEFAULT_CODE_EDITOR_LANGUAGE;
};

const drawCode = (node: Extract<DiagramNode, { type: "code" }>): Drawn => {
    const content: CodeBlockContent = {
        code: node.code,
        language: toLanguage(node.language) as CodeBlockContent["language"],
        fontSize: DEFAULT_CODE_EDITOR_FONT_SIZE,
    };
    const { width, height } = CodeBlockImage.getNaturalSize(content);
    const element = ElementCreationUtil.createImage({
        base: { x: 0, y: 0, width, height },
        fileId: CodeBlockImage.getFileId(content),
        callback: draft => {
            draft.customData = CustomData.createCodeblock({ ...content, shadow: false });
            return draft;
        },
    });
    return { elements: [element], files: [CodeBlockImage.createFile(element)], width, height };
};

const fromBlock = ({ element, file }: { element: ExcalidrawElement; file: BinaryFileData }) => ({
    elements: [element],
    files: [file],
    width: element.width,
    height: element.height,
});

const drawNode = async (node: DiagramNode, options: Options): Promise<Drawn> => {
    switch (node.type) {
        case "shape":
            return drawShape(node);
        case "sticky":
            return drawSticky(node);
        case "text":
            return drawText(node);
        case "code":
            return drawCode(node);
        case "note":
            return fromBlock(
                await MarkdownNote.create({
                    markdown: node.markdown,
                    width: NOTE_WIDTHS[node.width ?? "M"],
                })
            );
        case "table":
            return fromBlock(
                await Table.create({
                    rows: node.rows,
                    headerRow: node.headerRow ?? true,
                    headerColumn: node.headerColumn ?? false,
                })
            );
        case "chart":
            return fromBlock(
                await Chart.create({
                    rows: node.rows,
                    chartType: node.chartType,
                    title: node.title ?? "",
                })
            );
        case "link": {
            const content = (await options.getLinkContent?.(node.url)) ?? {
                url: node.url,
                look: "compact" as const,
            };
            return fromBlock(await LinkCard.create(content));
        }
    }
};

/** The space an arrow's label takes, so the layout leaves room for it */
const measureEdgeLabel = (edge: DiagramEdge) =>
    edge.label ? { width: edge.label.length * 9 + 20, height: 30 } : { width: 0, height: 0 };

type Layout = { boxes: Map<string, Box>; routes: Map<number, Point[]> };

/** Titles above the diagram, and other nodes on their own in rows below it */
const placeLoose = (
    spec: DiagramSpec,
    sizes: Map<string, Drawn>,
    loose: DiagramNode[],
    boxes: Map<string, Box>,
    routes: Map<number, Point[]>
): Layout => {
    const all = [...boxes.values()];
    const minX = all.length ? Math.min(...all.map(box => box.x)) : 0;
    const minY = all.length ? Math.min(...all.map(box => box.y)) : 0;
    const maxX = all.length ? Math.max(...all.map(box => box.x + box.width)) : 0;
    const maxY = all.length ? Math.max(...all.map(box => box.y + box.height)) : 0;
    const rowWidth = Math.max(maxX - minX, 1200);

    let top = minY;
    loose
        .filter(node => node.type === "text")
        .reverse()
        .forEach(node => {
            const { width, height } = sizes.get(node.id)!;
            top -= height + GAP.nodes;
            boxes.set(node.id, { x: minX, y: top, width, height });
        });

    let x = minX;
    let y = all.length ? maxY + GAP.ranks : minY;
    let rowHeight = 0;
    loose
        .filter(node => node.type !== "text")
        .forEach(node => {
            const { width, height } = sizes.get(node.id)!;
            if (x > minX && x + width > minX + rowWidth) {
                x = minX;
                y += rowHeight + GAP.nodes;
                rowHeight = 0;
            }
            boxes.set(node.id, { x, y, width, height });
            x += width + GAP.nodes;
            rowHeight = Math.max(rowHeight, height);
        });
    return { boxes, routes };
};

/** Everything laid out from scratch, with room for groups and arrows' labels */
const layOut = (spec: DiagramSpec, sizes: Map<string, Drawn>): Layout => {
    // Nodes on their own, like a title, a note or a table, go around the diagram instead
    const connected = new Set(spec.edges.flatMap(edge => [edge.from, edge.to]));
    const isLoose = (node: DiagramNode) => !connected.has(node.id) && !node.group;
    const loose = spec.nodes.filter(isLoose);
    const linked = spec.nodes.filter(node => !isLoose(node));
    if (linked.length === 0) return placeLoose(spec, sizes, loose, new Map(), new Map());

    const graph = new dagre.graphlib.Graph({ compound: true, multigraph: true });
    graph.setGraph({
        rankdir: spec.direction === "down" ? "TB" : "LR",
        nodesep: GAP.nodes,
        ranksep: GAP.ranks,
        edgesep: 30,
    });
    graph.setDefaultEdgeLabel(() => ({}));

    spec.groups.forEach(group => graph.setNode(group.id, {}));
    linked.forEach(node => {
        const { width, height } = sizes.get(node.id)!;
        graph.setNode(node.id, { width, height });
        if (node.group) graph.setParent(node.id, node.group);
    });
    spec.edges.forEach((edge, i) => {
        if (edge.from === edge.to) return;
        graph.setEdge(edge.from, edge.to, { ...measureEdgeLabel(edge), labelpos: "c" }, String(i));
    });

    dagre.layout(graph);

    const boxes = new Map<string, Box>();
    linked.forEach(node => {
        const { x, y, width, height } = graph.node(node.id);
        boxes.set(node.id, { x: x - width / 2, y: y - height / 2, width, height });
    });
    const routes = new Map<number, Point[]>();
    spec.edges.forEach((edge, i) => {
        if (edge.from === edge.to) return;
        const points = graph.edge({ v: edge.from, w: edge.to, name: String(i) })?.points;
        if (points?.length) routes.set(i, points);
    });
    return placeLoose(spec, sizes, loose, boxes, routes);
};

const overlaps = (a: Box, b: Box, margin = 30) =>
    a.x < b.x + b.width + margin &&
    b.x < a.x + a.width + margin &&
    a.y < b.y + b.height + margin &&
    b.y < a.y + a.height + margin;

/**
 * Nodes that were there keep their place. New ones go next to one they're connected to, or
 * after everything, and move along until they're in the clear.
 */
const placeAround = (
    spec: DiagramSpec,
    sizes: Map<string, Drawn>,
    positions: Map<string, Point>
): Layout => {
    const boxes = new Map<string, Box>();
    spec.nodes.forEach(node => {
        const position = positions.get(node.id);
        const { width, height } = sizes.get(node.id)!;
        if (position) boxes.set(node.id, { ...position, width, height });
    });
    const isRight = spec.direction !== "down";

    spec.nodes.forEach(node => {
        if (boxes.has(node.id)) return;
        const { width, height } = sizes.get(node.id)!;
        const neighbour = spec.edges
            .flatMap(edge => [
                ...(edge.to === node.id ? [edge.from] : []),
                ...(edge.from === node.id ? [edge.to] : []),
            ])
            .map(id => boxes.get(id))
            .find(Boolean);

        let box: Box;
        if (neighbour) {
            box = isRight
                ? { x: neighbour.x + neighbour.width + GAP.ranks, y: neighbour.y, width, height }
                : { x: neighbour.x, y: neighbour.y + neighbour.height + GAP.ranks, width, height };
        } else {
            const all = [...boxes.values()];
            const right = Math.max(...all.map(b => b.x + b.width), 0);
            const top = Math.min(...all.map(b => b.y), 0);
            box = { x: all.length ? right + GAP.ranks : 0, y: all.length ? top : 0, width, height };
        }
        // Down or right of what's in the way
        for (let tries = 0; tries < 50; tries++) {
            const blocker = [...boxes.values()].find(other => overlaps(box, other));
            if (!blocker) break;
            box = isRight
                ? { ...box, y: blocker.y + blocker.height + GAP.nodes }
                : { ...box, x: blocker.x + blocker.width + GAP.nodes };
        }
        boxes.set(node.id, box);
    });
    return { boxes, routes: new Map() };
};

const center = (box: Box): Point => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

/** Where the line from the box's center towards a point leaves the box */
const edgeOf = (box: Box, towards: Point): Point => {
    const c = center(box);
    const dx = towards.x - c.x;
    const dy = towards.y - c.y;
    if (dx === 0 && dy === 0) return c;
    const scale = Math.min(
        dx === 0 ? Infinity : box.width / 2 / Math.abs(dx),
        dy === 0 ? Infinity : box.height / 2 / Math.abs(dy)
    );
    return { x: c.x + dx * scale, y: c.y + dy * scale };
};

const STROKE_STYLES = { solid: "solid", dashed: "dashed", dotted: "dotted" } as const;

const drawArrow = (
    edge: DiagramEdge,
    from: { box: Box; element: ExcalidrawElement },
    to: { box: Box; element: ExcalidrawElement },
    route: Point[] | undefined
): ExcalidrawElement[] => {
    const points =
        route && route.length >= 2
            ? route
            : [edgeOf(from.box, center(to.box)), edgeOf(to.box, center(from.box))];
    const [start] = points;
    const heads = edge.heads ?? "end";

    const elements = fromSkeleton({
        type: "arrow",
        x: start!.x,
        y: start!.y,
        points: points.map(point => [point.x - start!.x, point.y - start!.y]),
        strokeStyle: STROKE_STYLES[edge.style ?? "solid"],
        roundness: points.length > 2 ? { type: 2 } : null,
        startArrowhead: heads === "both" ? "arrow" : null,
        endArrowhead: heads === "none" ? null : "arrow",
        customData: CustomData.createDefault({ shadow: false, type: "arrow" }),
        ...(edge.label ? { label: { text: edge.label, fontSize: 16 } } : {}),
    } as ExcalidrawElementSkeleton);

    const [arrow, ...label] = elements;
    const bound = {
        ...arrow!,
        startBinding: { elementId: from.element.id, focus: 0, gap: 4 },
        endBinding: { elementId: to.element.id, focus: 0, gap: 4 },
    } as ExcalidrawElement;
    return [bound, ...label];
};

const move = (elements: ExcalidrawElement[], dx: number, dy: number) =>
    elements.map(element => ({ ...element, x: element.x + dx, y: element.y + dy }));

/** BanjoDraw's shapes, blocks, arrows and frames for a diagram, laid out */
const build = async (spec: DiagramSpec, options: Options = {}): Promise<BuiltDiagram> => {
    const drawn = new Map<string, Drawn>();
    await Promise.all(
        spec.nodes.map(async node => drawn.set(node.id, await drawNode(node, options)))
    );

    const keeps = spec.nodes.some(node => options.positions?.has(node.id));
    const { boxes, routes } =
        keeps && options.positions
            ? placeAround(spec, drawn, options.positions)
            : layOut(spec, drawn);

    // Each node's elements where the layout put it
    const placed = new Map<string, ExcalidrawElement[]>();
    spec.nodes.forEach(node => {
        const { elements } = drawn.get(node.id)!;
        const box = boxes.get(node.id)!;
        placed.set(node.id, move(elements, box.x, box.y));
    });

    // Arrows, and the nodes they're bound to
    const boundTo = new Map<string, { id: string; type: "arrow" }[]>();
    const arrows: { edge: DiagramEdge; elements: ExcalidrawElement[] }[] = [];
    spec.edges.forEach((edge, i) => {
        if (edge.from === edge.to) return;
        const from = placed.get(edge.from)?.[0];
        const to = placed.get(edge.to)?.[0];
        if (!from || !to) return;
        const elements = drawArrow(
            edge,
            { box: boxes.get(edge.from)!, element: from },
            { box: boxes.get(edge.to)!, element: to },
            routes.get(i)
        );
        arrows.push({ edge, elements });
        for (const id of [from.id, to.id]) {
            boundTo.set(id, [...(boundTo.get(id) ?? []), { id: elements[0]!.id, type: "arrow" }]);
        }
    });
    const withBindings = (element: ExcalidrawElement) => {
        const added = boundTo.get(element.id);
        if (!added) return element;
        return { ...element, boundElements: [...(element.boundElements ?? []), ...added] };
    };

    // Frames around groups, after what's in them
    const groupOf = new Map(spec.nodes.map(node => [node.id, node.group]));
    const elements: ExcalidrawElement[] = [];
    const ungrouped = spec.nodes.filter(node => !node.group);
    ungrouped.forEach(node => elements.push(...placed.get(node.id)!.map(withBindings)));

    spec.groups.forEach(group => {
        const members = spec.nodes.filter(node => node.group === group.id);
        if (members.length === 0) return;
        const children = members.flatMap(node => placed.get(node.id)!.map(withBindings));
        const inside = arrows
            .filter(
                ({ edge }) =>
                    groupOf.get(edge.from) === group.id && groupOf.get(edge.to) === group.id
            )
            .flatMap(arrow => arrow.elements);

        const [minX, minY, maxX, maxY] = ExcalidrawUtil.getCommonBounds([...children, ...inside]);
        const [frame] = fromSkeleton({
            type: "frame",
            children: [],
            x: minX - FRAME_PADDING,
            y: minY - FRAME_PADDING,
            width: maxX - minX + FRAME_PADDING * 2,
            height: maxY - minY + FRAME_PADDING * 2,
            name: group.label,
        } as ExcalidrawElementSkeleton);
        const framed = [...children, ...inside].map(element => ({
            ...element,
            frameId: frame!.id,
        }));
        elements.push(...framed, frame!);
    });

    const framedIds = new Set(elements.map(element => element.id));
    arrows.forEach(arrow =>
        arrow.elements.forEach(element => !framedIds.has(element.id) && elements.push(element))
    );

    return {
        elements: elements as ExcalidrawElements,
        files: [...drawn.values()].flatMap(node => node.files),
        positions: new Map([...boxes].map(([id, box]) => [id, { x: box.x, y: box.y }])),
        isInPlace: keeps,
        elementOf: new Map([...placed].map(([id, [main]]) => [id, main!.id])),
    };
};

export const DiagramBuilder = { build };
