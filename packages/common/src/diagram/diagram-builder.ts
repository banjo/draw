import { DiagramColor, DiagramEdge, DiagramNode, DiagramShape, DiagramSpec } from "../model/ai";
import { CustomData, CustomElementType } from "../model/excalidraw-custom-data";
import { ExcalidrawElement } from "../model/excalidraw-element";
import {
    BlockContent,
    BlockFileId,
    BlockSize,
    CHART_DEFAULT_CONTENT,
    CODE_EDITOR_LANGUAGES,
    CodeBlockContent,
    DEFAULT_CODE_EDITOR_FONT_SIZE,
    DEFAULT_CODE_EDITOR_LANGUAGE,
    LinkContent,
    NOTE_WIDTHS,
} from "./blocks";
import {
    DiagramLayout,
    FRAME_LABEL,
    FRAME_PADDING,
    GAP,
    getBounds,
    Outline,
    RouteEnd,
} from "./diagram-layout";
import { ElementBounds } from "./element-bounds";
import { Box, ElementFactory, Point } from "./element-factory";
import { EstimatedTextMetrics, TextMetrics } from "./text-metrics";

export type { Box, Point } from "./element-factory";

/** A node drawn: its elements at 0,0, the one arrows connect to first */
export type Drawn<File = unknown> = {
    elements: ExcalidrawElement[];
    files: File[];
    width: number;
    height: number;
};

export type BlockNode = Extract<
    DiagramNode,
    { type: "note" | "table" | "chart" | "code" | "link" }
>;

export type BuiltDiagram<File = unknown> = {
    elements: ExcalidrawElement[];
    files: File[];
    /** Where each node ended up, its top left corner */
    positions: Map<string, Point>;
    /** Whether nodes kept the places they were given, rather than all being laid out */
    isInPlace: boolean;
    /** The element each node is, the one arrows connect to */
    elementOf: Map<string, string>;
    /** The frame each group is */
    frameOf: Map<string, string>;
};

export type BuildOptions<File = unknown> = {
    /** Where nodes that were on the canvas already were, by id: they stay there */
    positions?: Map<string, Point>;
    /**
     * How text is measured. Without it, text is estimated, and marked to be measured by the
     * first browser that shows it.
     */
    metrics?: TextMetrics;
    /** A link card's title and icon */
    getLinkContent?: (url: string) => Promise<LinkContent>;
    /** Draws blocks, e.g. with their images in a browser. Without it they're estimated. */
    drawBlock?: (
        node: BlockNode,
        getLinkContent?: (url: string) => Promise<LinkContent>
    ) => Promise<Drawn<File>>;
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

/** A sticky note is yellow, and can be made any other color */
export const STICKY_NOTE_STYLE = { backgroundColor: "#ffec99", fillStyle: "solid" } as const;

type ShapeLook = {
    type: "rectangle" | "ellipse" | "diamond";
    custom?: CustomElementType;
    isRound?: boolean;
    /** How much bigger than its label it is */
    scale: [number, number];
};

export const SHAPES: Record<DiagramShape, ShapeLook> = {
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

export const LABEL_FONT_SIZE = 20;
export const EDGE_LABEL_FONT_SIZE = 16;
export const TEXT_SIZES = { small: 16, medium: 20, large: 32 } as const;
// Roughly Excalifont's width per character, at LABEL_FONT_SIZE
const CHAR_WIDTH = 11;
const LINE_HEIGHT = 25;
export { FRAME_PADDING };

/** How big a label is, wrapped at a width that suits a shape */
const measureLabel = (text: string) => {
    const longest = Math.max(...text.split("\n").map(line => line.length), 1);
    const width = Math.min(Math.max(longest * CHAR_WIDTH, 80), 240);
    const lines = text
        .split("\n")
        .reduce((sum, line) => sum + Math.max(1, Math.ceil((line.length * CHAR_WIDTH) / width)), 0);
    return { width, height: lines * LINE_HEIGHT };
};

type Context = {
    metrics: TextMetrics;
    /** Whether text is measured, or estimated and to be measured by a browser */
    isMeasured: boolean;
};

const getContext = (options: { metrics?: TextMetrics }): Context => ({
    metrics: options.metrics ?? EstimatedTextMetrics,
    isMeasured: Boolean(options.metrics),
});

const unmeasured = (element: ExcalidrawElement, context: Context) =>
    context.isMeasured
        ? element
        : ({
              ...element,
              customData: {
                  ...(element.customData ?? { shadow: false, type: "text" }),
                  unmeasured: true,
              },
          } as ExcalidrawElement);

/** A shape or an arrow with its label, if it has one */
const withLabel = (
    container: ExcalidrawElement,
    text: string | undefined,
    fontSize: number,
    context: Context
) => {
    if (!text) return [container];
    const labelled = ElementFactory.label({
        container,
        text,
        fontSize,
        metrics: context.metrics,
    });
    return [labelled.container, unmeasured(labelled.label, context)];
};

/** A shape's size for its label */
const getShapeSize = (shape: DiagramShape, label: string) => {
    const look = SHAPES[shape];
    const size = measureLabel(label);
    let width = Math.max(150, (size.width + 60) * look.scale[0]);
    let height = Math.max(80, (size.height + 50) * look.scale[1]);
    if (shape === "circle") width = height = Math.max(width, height, 110);
    return { width, height };
};

const shapeStyle = (shape: DiagramShape, color: DiagramColor | undefined) => {
    const look = SHAPES[shape];
    return {
        type: look.type,
        roundness: look.isRound ? { type: 3 } : null,
        ...(color ? { backgroundColor: FILLS[color], fillStyle: "solid" as const } : {}),
        customData: CustomData.createDefault({ shadow: false, type: look.custom ?? look.type }),
    };
};

const drawShape = (node: Extract<DiagramNode, { type: "shape" }>, context: Context): Drawn => {
    const { width, height } = getShapeSize(node.shape, node.label ?? "");
    const shape = ElementFactory.shape({
        x: 0,
        y: 0,
        width,
        height,
        ...shapeStyle(node.shape, node.color),
    });
    return {
        elements: withLabel(shape, node.label, LABEL_FONT_SIZE, context),
        files: [],
        width,
        height,
    };
};

const getStickySize = (text: string) => {
    const label = measureLabel(text);
    return Math.min(Math.max(170, label.height + 80, label.width + 50), 260);
};

const drawSticky = (node: Extract<DiagramNode, { type: "sticky" }>, context: Context): Drawn => {
    const size = getStickySize(node.text);
    const shape = ElementFactory.shape({
        type: "rectangle",
        x: 0,
        y: 0,
        width: size,
        height: size,
        ...STICKY_NOTE_STYLE,
        ...(node.color ? { backgroundColor: FILLS[node.color] } : {}),
        customData: CustomData.createDefault({ shadow: false, type: "sticky-note" }),
    });
    return {
        elements: withLabel(shape, node.text, LABEL_FONT_SIZE, context),
        files: [],
        width: size,
        height: size,
    };
};

const drawText = (node: Extract<DiagramNode, { type: "text" }>, context: Context): Drawn => {
    const element = unmeasured(
        ElementFactory.text({
            x: 0,
            y: 0,
            text: node.text,
            fontSize: TEXT_SIZES[node.size ?? "medium"],
            metrics: context.metrics,
            customData: CustomData.createDefault({ shadow: false, type: "text" }),
        }),
        context
    );
    return { elements: [element], files: [], width: element.width, height: element.height };
};

/** The code block languages are a fixed list: the closest one, by name */
export const toCodeLanguage = (language: string): CodeBlockContent["language"] => {
    const name = language.trim().toLowerCase();
    const aliases: Record<string, CodeBlockContent["language"]> = {
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

/** A code block's content, from a node */
export const toCodeContent = (node: Extract<DiagramNode, { type: "code" }>): CodeBlockContent => ({
    code: node.code,
    language: toCodeLanguage(node.language),
    fontSize: DEFAULT_CODE_EDITOR_FONT_SIZE,
});

const imageBlock = (
    fileId: string,
    size: { width: number; height: number },
    customData: CustomData
): Drawn => {
    const element = ElementFactory.image({ x: 0, y: 0, ...size, fileId, customData });
    return { elements: [element], files: [], width: size.width, height: size.height };
};

/** A block without its image, which the first browser that shows it draws and measures */
const estimateBlock = async (
    node: BlockNode,
    getLinkContent?: (url: string) => Promise<LinkContent>
): Promise<Drawn> => {
    switch (node.type) {
        case "code": {
            const content = toCodeContent(node);
            return imageBlock(
                BlockFileId.code(content),
                BlockSize.code(content),
                CustomData.createCodeblock({ ...content, shadow: false })
            );
        }
        case "note": {
            const content = {
                markdown: node.markdown,
                look: "paper" as const,
                width: NOTE_WIDTHS[node.width ?? "M"],
            };
            return imageBlock(BlockFileId.note(content), BlockSize.estimate.note(content), {
                shadow: false,
                type: "markdown",
                ...content,
                unmeasured: true,
            } as CustomData);
        }
        case "table": {
            const content = {
                rows: BlockContent.normalizeRows(node.rows),
                look: "sketchy" as const,
                headerRow: node.headerRow ?? true,
                headerColumn: node.headerColumn ?? false,
            };
            return imageBlock(BlockFileId.table(content), BlockSize.estimate.table(content), {
                shadow: false,
                type: "table",
                ...content,
                unmeasured: true,
            } as CustomData);
        }
        case "chart": {
            const content = {
                ...CHART_DEFAULT_CONTENT,
                rows: BlockContent.normalizeRows(node.rows),
                chartType: node.chartType,
                title: node.title ?? "",
            };
            return imageBlock(BlockFileId.chart(content), BlockSize.estimate.chart(), {
                shadow: false,
                type: "chart",
                ...content,
                unmeasured: true,
            } as CustomData);
        }
        case "link": {
            const content = (await getLinkContent?.(node.url).catch(() => undefined)) ?? {
                url: node.url,
                look: "compact" as const,
            };
            return imageBlock(BlockFileId.link(content), BlockSize.estimate.link(content), {
                shadow: false,
                type: "link",
                ...content,
                unmeasured: true,
            } as CustomData);
        }
    }
};

const isBlock = (node: DiagramNode): node is BlockNode =>
    node.type === "note" ||
    node.type === "table" ||
    node.type === "chart" ||
    node.type === "code" ||
    node.type === "link";

/** A node's elements at 0,0 */
const drawNode = async <File>(
    node: DiagramNode,
    options: BuildOptions<File> = {}
): Promise<Drawn<File>> => {
    const context = getContext(options);
    if (isBlock(node)) {
        const draw =
            options.drawBlock ?? (estimateBlock as NonNullable<BuildOptions<File>["drawBlock"]>);
        return draw(node, options.getLinkContent);
    }
    switch (node.type) {
        case "shape":
            return drawShape(node, context) as Drawn<File>;
        case "sticky":
            return drawSticky(node, context) as Drawn<File>;
        case "text":
            return drawText(node, context) as Drawn<File>;
    }
};

type Size = { width: number; height: number };

/** Titles above the diagram, and other nodes on their own in rows below it */
const placeLoose = (
    sizes: Map<string, Size>,
    loose: DiagramNode[],
    boxes: Map<string, Box>,
    hasGroups: boolean
) => {
    const all = [...boxes.values()];
    // Frames reach past their nodes, with their names above them
    const frameRoom = hasGroups ? FRAME_PADDING : 0;
    const minX = all.length ? Math.min(...all.map(box => box.x)) - frameRoom : 0;
    const minY = all.length
        ? Math.min(...all.map(box => box.y)) - (hasGroups ? FRAME_PADDING + FRAME_LABEL : 0)
        : 0;
    const maxX = all.length ? Math.max(...all.map(box => box.x + box.width)) + frameRoom : 0;
    const maxY = all.length ? Math.max(...all.map(box => box.y + box.height)) + frameRoom : 0;
    const rowWidth = Math.max(maxX - minX, 1200);

    let top = minY;
    loose
        .filter(node => node.type === "text")
        .reverse()
        .forEach(node => {
            const { width, height } = sizes.get(node.id)!;
            top -= height + GAP.nodes / 2;
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
    return boxes;
};

/** Everything laid out from scratch: groups side by side, and loose nodes around them */
const layOut = (spec: DiagramSpec, sizes: Map<string, Size>) => {
    // Nodes on their own, like a title, a note or a table, go around the diagram instead
    const connected = new Set(spec.edges.flatMap(edge => [edge.from, edge.to]));
    const isLoose = (node: DiagramNode) => !connected.has(node.id) && !node.group;
    const loose = spec.nodes.filter(isLoose);
    const linked = spec.nodes.filter(node => !isLoose(node));
    const boxes = linked.length
        ? DiagramLayout.layOut(spec, linked, sizes)
        : new Map<string, Box>();
    return placeLoose(
        sizes,
        loose,
        boxes,
        linked.some(node => node.group)
    );
};

const overlaps = (a: Box, b: Box, margin = 30) =>
    a.x < b.x + b.width + margin &&
    b.x < a.x + a.width + margin &&
    a.y < b.y + b.height + margin &&
    b.y < a.y + a.height + margin;

type PlaceAroundProps = {
    direction: DiagramSpec["direction"];
    /** The nodes to place, with their sizes */
    nodes: { id: string; width: number; height: number }[];
    edges: Pick<DiagramEdge, "from" | "to">[];
    /** What's there already and stays: by node id, or any id for what's only in the way */
    placed: Map<string, Box>;
    /** More a spot has to be clear of, like a frame it would grow onto others */
    isFree?: (id: string, box: Box) => boolean;
};

/** Spots right of, below, left of and above each box, nearest to where it'd go first */
const getAlternatives = (boxes: Box[], size: Size, preferred: Box) => {
    const { width, height } = size;
    const spots = boxes.flatMap(other => [
        { x: other.x + other.width + GAP.nodes, y: other.y, width, height },
        { x: other.x, y: other.y + other.height + GAP.nodes, width, height },
        { x: other.x - GAP.nodes - width, y: other.y, width, height },
        { x: other.x, y: other.y - GAP.nodes - height, width, height },
    ]);
    const distance = (box: Box) => Math.hypot(box.x - preferred.x, box.y - preferred.y);
    return spots.sort((a, b) => distance(a) - distance(b));
};

/**
 * New nodes next to one they're connected to, or after everything, moved along until they're
 * in the clear. What's placed already stays where it is.
 */
const placeNew = ({ direction, nodes, edges, placed, isFree }: PlaceAroundProps) => {
    const boxes = new Map(placed);
    const isRight = direction !== "down";

    nodes.forEach(node => {
        if (boxes.has(node.id)) return;
        const { width, height } = node;
        const neighbour = edges
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
        const first = box;
        // Down or right of what's in the way
        for (let tries = 0; tries < 50; tries++) {
            const blocker = [...boxes.values()].find(other => overlaps(box, other));
            if (!blocker) break;
            box = isRight
                ? { ...box, y: blocker.y + blocker.height + GAP.nodes }
                : { ...box, x: blocker.x + blocker.width + GAP.nodes };
        }
        if (isFree && !isFree(node.id, box)) {
            const others = [...boxes.values()];
            const free = getAlternatives(others, node, first).find(
                spot => !others.some(other => overlaps(spot, other)) && isFree(node.id, spot)
            );
            if (free) box = free;
        }
        boxes.set(node.id, box);
    });
    return boxes;
};

/** Nodes that were there keep their place, and new ones go around them */
const placeAround = (
    spec: DiagramSpec,
    sizes: Map<string, Size>,
    positions: Map<string, Point>
) => {
    const placed = new Map<string, Box>();
    spec.nodes.forEach(node => {
        const position = positions.get(node.id);
        if (position) placed.set(node.id, { ...position, ...sizes.get(node.id)! });
    });
    return placeNew({
        direction: spec.direction,
        nodes: spec.nodes.map(node => ({ id: node.id, ...sizes.get(node.id)! })),
        edges: spec.edges,
        placed,
    });
};

type DrawArrowProps = {
    edge: Omit<DiagramEdge, "from" | "to">;
    from: { box: Box; id: string; outline?: Outline };
    to: { box: Box; id: string; outline?: Outline };
    /** The path it takes, else one between the sides that face each other */
    route?: Point[];
    /** What a path it finds goes around */
    obstacles?: Box[];
    metrics?: TextMetrics;
};

const drawArrow = ({
    edge,
    from,
    to,
    route,
    obstacles = [],
    metrics,
}: DrawArrowProps): ExcalidrawElement[] => {
    const context = getContext({ metrics });
    const path =
        route && route.length >= 2
            ? route
            : DiagramLayout.routeOne(
                  { id: from.id, box: from.box, outline: from.outline },
                  { id: to.id, box: to.box, outline: to.outline },
                  obstacles.map((box, i) => ({ id: `obstacle-${i}`, box }))
              );
    const points = edge.label ? DiagramLayout.withLabelSpot(path) : path;
    const heads = edge.heads ?? "end";

    const arrow = ElementFactory.arrow({
        points,
        strokeStyle: edge.style ?? "solid",
        startArrowhead: heads === "both" ? "arrow" : null,
        endArrowhead: heads === "none" ? null : "arrow",
        startBinding: { elementId: from.id, focus: 0, gap: 4 },
        endBinding: { elementId: to.id, focus: 0, gap: 4 },
    });
    return withLabel(arrow, edge.label, EDGE_LABEL_FONT_SIZE, context);
};

const move = (elements: ExcalidrawElement[], dx: number, dy: number) =>
    elements.map(element => ({ ...element, x: element.x + dx, y: element.y + dy }));

/** A frame around elements, which they're in */
const drawFrame = (name: string, members: ExcalidrawElement[]) => {
    const [minX, minY, maxX, maxY] = ElementBounds.getCommonBounds(members);
    const frame = ElementFactory.frame({
        x: minX - FRAME_PADDING,
        y: minY - FRAME_PADDING,
        width: maxX - minX + FRAME_PADDING * 2,
        height: maxY - minY + FRAME_PADDING * 2,
        name,
    });
    const framed = members.map(element => ({ ...element, frameId: frame.id }));
    return { frame, framed };
};

/** The outline arrows end at: Excalidraw's ellipses and diamonds, else the box */
const getOutline = (element: ExcalidrawElement): Outline =>
    element.type === "ellipse" || element.type === "diamond" ? element.type : "rectangle";

/** BanjoDraw's shapes, blocks, arrows and frames for a diagram, laid out */
const build = async <File = unknown>(
    spec: DiagramSpec,
    options: BuildOptions<File> = {}
): Promise<BuiltDiagram<File>> => {
    const drawn = new Map<string, Drawn<File>>();
    await Promise.all(
        spec.nodes.map(async node => drawn.set(node.id, await drawNode(node, options)))
    );

    const keeps = spec.nodes.some(node => options.positions?.has(node.id));
    const boxes =
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

    // Paths for all arrows at once, so they share sides and go around everything
    const ends = new Map<string, RouteEnd>();
    spec.nodes.forEach(node => {
        const main = placed.get(node.id)?.[0];
        if (!main) return;
        ends.set(node.id, { id: node.id, box: boxes.get(node.id)!, outline: getOutline(main) });
    });
    const routes = DiagramLayout.route(
        spec.edges.flatMap((edge, i) => {
            const from = ends.get(edge.from);
            const to = ends.get(edge.to);
            return from && to && edge.from !== edge.to ? [{ key: String(i), from, to }] : [];
        }),
        [...ends.values()],
        spec.groups.flatMap(group => {
            const ids = spec.nodes.filter(node => node.group === group.id).map(node => node.id);
            const bounds = getBounds(ids.map(id => boxes.get(id)!));
            if (!bounds) return [];
            const box = {
                x: bounds.x - FRAME_PADDING,
                y: bounds.y - FRAME_PADDING - FRAME_LABEL,
                width: bounds.width + FRAME_PADDING * 2,
                height: bounds.height + FRAME_PADDING * 2 + FRAME_LABEL,
            };
            return [{ box, ids: new Set(ids) }];
        })
    );

    // Arrows, and the nodes they're bound to
    const boundTo = new Map<string, { id: string; type: "arrow" }[]>();
    const arrows: { edge: DiagramEdge; elements: ExcalidrawElement[] }[] = [];
    spec.edges.forEach((edge, i) => {
        if (edge.from === edge.to) return;
        const from = placed.get(edge.from)?.[0];
        const to = placed.get(edge.to)?.[0];
        if (!from || !to) return;
        const elements = drawArrow({
            edge,
            from: { box: boxes.get(edge.from)!, id: from.id },
            to: { box: boxes.get(edge.to)!, id: to.id },
            route: routes.get(String(i)),
            metrics: options.metrics,
        });
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
    const frameOf = new Map<string, string>();
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

        const { frame, framed } = drawFrame(group.label, [...children, ...inside]);
        frameOf.set(group.id, frame.id);
        elements.push(...framed, frame);
    });

    const framedIds = new Set(elements.map(element => element.id));
    arrows.forEach(arrow =>
        arrow.elements.forEach(element => !framedIds.has(element.id) && elements.push(element))
    );

    return {
        elements,
        files: [...drawn.values()].flatMap(node => node.files),
        positions: new Map([...boxes].map(([id, box]) => [id, { x: box.x, y: box.y }])),
        isInPlace: keeps,
        elementOf: new Map([...placed].map(([id, [main]]) => [id, main!.id])),
        frameOf,
    };
};

export const DiagramBuilder = {
    build,
    drawNode,
    drawArrow,
    drawFrame,
    placeNew,
    getShapeSize,
    getStickySize,
    shapeStyle,
    withLabel: (
        container: ExcalidrawElement,
        text: string | undefined,
        fontSize: number,
        metrics?: TextMetrics
    ) => withLabel(container, text, fontSize, getContext({ metrics })),
    unmeasured: (element: ExcalidrawElement, metrics?: TextMetrics) =>
        unmeasured(element, getContext({ metrics })),
    move,
    getOutline,
};
