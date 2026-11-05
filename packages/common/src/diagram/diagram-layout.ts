import dagre from "@dagrejs/dagre";
import { DiagramEdge, DiagramNode, DiagramSpec } from "../model/ai";
import { Box, Point } from "./element-factory";

/**
 * Where a diagram's nodes go, and the paths its arrows take between them. Groups are laid out
 * on their own first, then placed like big nodes, so they sit side by side rather than
 * overlapping in steps. Arrows leave the side that faces the other end, spread out when there
 * are several, and go around what's in their way at right angles.
 */

type Size = { width: number; height: number };
type Direction = DiagramSpec["direction"];

export const GAP = { nodes: 60, ranks: 110 };
export const FRAME_PADDING = 40;
/** Room above a frame for its name */
export const FRAME_LABEL = 30;
/** How far from a shape an arrow ends, like Excalidraw's own */
const BINDING_GAP = 4;
/** Room kept around what an arrow goes past */
const CLEARANCE = 12;
/** Between arrows that run side by side */
const CHANNEL = 14;

const center = (box: Box): Point => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

const pad = (box: Box, by: number): Box => ({
    x: box.x - by,
    y: box.y - by,
    width: box.width + by * 2,
    height: box.height + by * 2,
});

export const getBounds = (boxes: Iterable<Box>): Box | undefined => {
    const all = [...boxes];
    if (all.length === 0) return undefined;
    const x = Math.min(...all.map(box => box.x));
    const y = Math.min(...all.map(box => box.y));
    const right = Math.max(...all.map(box => box.x + box.width));
    const bottom = Math.max(...all.map(box => box.y + box.height));
    return { x, y, width: right - x, height: bottom - y };
};

const shift = (boxes: Map<string, Box>, dx: number, dy: number) =>
    new Map([...boxes].map(([id, box]) => [id, { ...box, x: box.x + dx, y: box.y + dy }]));

// Layout

type Item = { id: string } & Size;
type Link = { from: string; to: string };

/** Items laid out by dagre, with the top left corner at 0,0 */
const runDagre = (
    items: Item[],
    links: Link[],
    direction: Direction,
    spacing: { nodes: number; ranks: number }
) => {
    const graph = new dagre.graphlib.Graph();
    graph.setGraph({
        rankdir: direction === "down" ? "TB" : "LR",
        nodesep: spacing.nodes,
        ranksep: spacing.ranks,
        edgesep: 30,
    });
    graph.setDefaultEdgeLabel(() => ({}));
    items.forEach(({ id, width, height }) => graph.setNode(id, { width, height }));
    links.forEach(({ from, to }) => {
        if (from === to) return;
        const existing = graph.edge(from, to) as { weight?: number } | undefined;
        graph.setEdge(from, to, { weight: (existing?.weight ?? 0) + 1 });
    });
    dagre.layout(graph);

    const boxes = new Map<string, Box>();
    items.forEach(({ id, width, height }) => {
        const { x, y } = graph.node(id);
        boxes.set(id, { x: x - width / 2, y: y - height / 2, width, height });
    });
    const bounds = getBounds(boxes.values())!;
    return shift(boxes, -bounds.x, -bounds.y);
};

/** Items without links between them, in rows of about as many as there are rows */
const runGrid = (items: Item[], spacing: number) => {
    const columns = Math.ceil(Math.sqrt(items.length));
    const widths = Array.from({ length: columns }, (_, column) =>
        Math.max(...items.filter((_item, i) => i % columns === column).map(item => item.width))
    );
    const boxes = new Map<string, Box>();
    let y = 0;
    for (let row = 0; row * columns < items.length; row++) {
        const inRow = items.slice(row * columns, row * columns + columns);
        const height = Math.max(...inRow.map(item => item.height));
        let x = 0;
        inRow.forEach((item, column) => {
            // In the middle of its cell
            boxes.set(item.id, {
                x: x + (widths[column]! - item.width) / 2,
                y: y + (height - item.height) / 2,
                width: item.width,
                height: item.height,
            });
            x += widths[column]! + spacing;
        });
        y += height + spacing;
    }
    return boxes;
};

/** Room between ranks for the arrows' labels */
const getRankGap = (edges: DiagramEdge[], direction: Direction) => {
    const labels = edges.filter(edge => edge.label);
    if (labels.length === 0) return GAP.ranks;
    const sizes = labels.map(edge => ({ width: edge.label!.length * 9 + 20, height: 30 }));
    const needed =
        direction === "down"
            ? Math.max(...sizes.map(size => size.height)) + 60
            : Math.max(...sizes.map(size => size.width)) + 60;
    return Math.min(Math.max(GAP.ranks, needed), 260);
};

/**
 * Connected and grouped nodes: each group laid out on its own, then the groups and the other
 * nodes laid out together, with the arrows between them
 */
const layOut = (spec: DiagramSpec, nodes: DiagramNode[], sizes: Map<string, Size>) => {
    const { direction } = spec;
    const groupOf = new Map(nodes.map(node => [node.id, node.group]));
    const unitOf = (id: string) => groupOf.get(id) ?? id;
    const edges = spec.edges.filter(
        edge => edge.from !== edge.to && groupOf.has(edge.from) && groupOf.has(edge.to)
    );

    // Each group's nodes, from the group's top left corner
    const inside = new Map<string, { boxes: Map<string, Box>; size: Size }>();
    spec.groups.forEach(group => {
        const members = nodes.filter(node => node.group === group.id);
        if (members.length === 0) return;
        const ids = new Set(members.map(node => node.id));
        const internal = edges.filter(edge => ids.has(edge.from) && ids.has(edge.to));
        const items = members.map(node => ({ id: node.id, ...sizes.get(node.id)! }));
        const laidOut =
            internal.length === 0 && items.length > 3
                ? runGrid(items, GAP.nodes)
                : runDagre(items, internal, direction, {
                      nodes: GAP.nodes,
                      ranks: getRankGap(internal, direction),
                  });
        const bounds = getBounds(laidOut.values())!;
        inside.set(group.id, {
            boxes: shift(laidOut, FRAME_PADDING, FRAME_PADDING + FRAME_LABEL),
            size: {
                width: bounds.width + FRAME_PADDING * 2,
                height: bounds.height + FRAME_PADDING * 2 + FRAME_LABEL,
            },
        });
    });

    const units: Item[] = [
        ...[...inside].map(([id, { size }]) => ({ id, ...size })),
        ...nodes.filter(node => !node.group).map(node => ({ id: node.id, ...sizes.get(node.id)! })),
    ];
    const between = edges.filter(edge => unitOf(edge.from) !== unitOf(edge.to));
    const placed = runDagre(
        units,
        between.map(edge => ({ from: unitOf(edge.from), to: unitOf(edge.to) })),
        direction,
        { nodes: GAP.nodes, ranks: getRankGap(between, direction) + 20 }
    );

    const boxes = new Map<string, Box>();
    nodes.forEach(node => {
        if (node.group) {
            const group = placed.get(node.group)!;
            const box = inside.get(node.group)!.boxes.get(node.id)!;
            boxes.set(node.id, { ...box, x: box.x + group.x, y: box.y + group.y });
        } else {
            boxes.set(node.id, placed.get(node.id)!);
        }
    });
    return boxes;
};

// Routing

type Side = "left" | "right" | "top" | "bottom";
export type Outline = "rectangle" | "ellipse" | "diamond";
export type RouteEnd = { id: string; box: Box; outline?: Outline };
type Segment = [Point, Point];

const isHorizontal = (side: Side) => side === "left" || side === "right";

/** The sides that face each other, across the widest gap between the boxes */
const getSides = (from: Box, to: Box): [Side, Side] => {
    const gapX = Math.max(to.x - (from.x + from.width), from.x - (to.x + to.width));
    const gapY = Math.max(to.y - (from.y + from.height), from.y - (to.y + to.height));
    const a = center(from);
    const b = center(to);
    if (gapX >= gapY) return b.x >= a.x ? ["right", "left"] : ["left", "right"];
    return b.y >= a.y ? ["bottom", "top"] : ["top", "bottom"];
};

/** A point on a side of a shape's outline, `offset` from the side's middle, a little out */
const getPort = (end: RouteEnd, side: Side, offset: number): Point => {
    const { box, outline = "rectangle" } = end;
    const c = center(box);
    const half = isHorizontal(side) ? box.height / 2 : box.width / 2;
    const depth = isHorizontal(side) ? box.width / 2 : box.height / 2;
    const along = Math.max(-half * 0.8, Math.min(half * 0.8, offset));
    const t = Math.abs(along) / half;
    // How far the outline reaches out at that point
    const reach = { ellipse: Math.sqrt(1 - t * t), diamond: 1 - t, rectangle: 1 }[outline];
    const out = depth * reach + BINDING_GAP;
    switch (side) {
        case "right":
            return { x: c.x + out, y: c.y + along };
        case "left":
            return { x: c.x - out, y: c.y + along };
        case "bottom":
            return { x: c.x + along, y: c.y + out };
        case "top":
            return { x: c.x + along, y: c.y - out };
    }
};

/** Whether a line crosses a box, by clipping it to the box */
const crosses = ([a, b]: Segment, box: Box) => {
    let t0 = 0;
    let t1 = 1;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const checks: [number, number][] = [
        [-dx, a.x - box.x],
        [dx, box.x + box.width - a.x],
        [-dy, a.y - box.y],
        [dy, box.y + box.height - a.y],
    ];
    for (const [p, q] of checks) {
        if (p === 0) {
            if (q < 0) return false;
            continue;
        }
        const r = q / p;
        if (p < 0) t0 = Math.max(t0, r);
        else t1 = Math.min(t1, r);
        if (t0 > t1) return false;
    }
    return true;
};

const toSegments = (points: Point[]) =>
    points.slice(1).map((point, i) => [points[i]!, point] as Segment);

const isClear = (points: Point[], obstacles: Box[]) =>
    toSegments(points).every(segment => obstacles.every(box => !crosses(segment, box)));

/** Whether a path runs along one that's there already, so they'd look like one */
const runsAlong = (points: Point[], taken: Segment[]) =>
    toSegments(points).some(([a, b]) =>
        taken.some(([c, d]) => {
            const isVertical = Math.abs(a.x - b.x) < 1 && Math.abs(c.x - d.x) < 1;
            const isFlat = Math.abs(a.y - b.y) < 1 && Math.abs(c.y - d.y) < 1;
            if (isVertical && Math.abs(a.x - c.x) < CHANNEL) {
                return (
                    Math.min(a.y, b.y) < Math.max(c.y, d.y) &&
                    Math.min(c.y, d.y) < Math.max(a.y, b.y)
                );
            }
            if (isFlat && Math.abs(a.y - c.y) < CHANNEL) {
                return (
                    Math.min(a.x, b.x) < Math.max(c.x, d.x) &&
                    Math.min(c.x, d.x) < Math.max(a.x, b.x)
                );
            }
            return false;
        })
    );

/** Paths from one port to another, the simplest first */
const getCandidates = (p: Point, q: Point, horizontal: boolean, obstacles: Box[]) => {
    // Along x for arrows that leave sideways, else along y, and back
    const flip = (point: Point): Point => (horizontal ? point : { x: point.y, y: point.x });
    const a = flip(p);
    const b = flip(q);
    const paths: Point[][] = [];

    if (Math.abs(a.y - b.y) < 6) paths.push([a, b]);

    // A step at some x between them, from the middle out
    const low = Math.min(a.x, b.x) + 16;
    const high = Math.max(a.x, b.x) - 16;
    const middle = (a.x + b.x) / 2;
    for (
        let k = 0;
        middle - Math.ceil(k / 2) * CHANNEL >= low || middle + Math.ceil(k / 2) * CHANNEL <= high;
        k++
    ) {
        const x = middle + (k % 2 === 0 ? 1 : -1) * Math.ceil(k / 2) * CHANNEL;
        if (x < low || x > high) continue;
        paths.push([a, { x, y: a.y }, { x, y: b.y }, b]);
    }

    // Around what's between, above or below it
    const sign = b.x >= a.x ? 1 : -1;
    const out = 24;
    const levels = obstacles
        .map(box => (horizontal ? { y: box.y, size: box.height } : { y: box.x, size: box.width }))
        .flatMap(box => [box.y - CLEARANCE * 2, box.y + box.size + CLEARANCE * 2])
        .sort((m, n) => Math.abs(m - (a.y + b.y) / 2) - Math.abs(n - (a.y + b.y) / 2));
    levels
        .slice(0, 16)
        .forEach(y =>
            paths.push([
                a,
                { x: a.x + sign * out, y: a.y },
                { x: a.x + sign * out, y },
                { x: b.x - sign * out, y },
                { x: b.x - sign * out, y: b.y },
                b,
            ])
        );

    // Straight across, if nothing else works
    paths.push([a, b]);
    return paths.map(path => path.map(flip));
};

const findPath = (
    p: Point,
    q: Point,
    horizontal: boolean,
    obstacles: Box[],
    taken: Segment[],
    /** Groups it's better to go around, as neither end is in them */
    avoid: Box[] = []
) => {
    const candidates = getCandidates(p, q, horizontal, [...obstacles, ...avoid]);
    const both = [...obstacles, ...avoid];
    return (
        candidates.find(path => isClear(path, both) && !runsAlong(path, taken)) ??
        candidates.find(path => isClear(path, both)) ??
        candidates.find(path => isClear(path, obstacles) && !runsAlong(path, taken)) ??
        candidates.find(path => isClear(path, obstacles)) ??
        candidates.find(path => path.length === 4) ??
        candidates.at(-1)!
    );
};

type RouteEdge = { key: string; from: RouteEnd; to: RouteEnd };
/** A group: the space its frame takes, and the nodes in it */
export type RouteArea = { box: Box; ids: Set<string> };

/**
 * Where on a side both ends can be, for a straight arrow: within the middle of both sides,
 * where they face each other
 */
const getSharedSpan = (from: Box, to: Box, horizontal: boolean) => {
    const span = (box: Box) => {
        const start = horizontal ? box.y : box.x;
        const length = horizontal ? box.height : box.width;
        return [start + length * 0.15, start + length * 0.85] as const;
    };
    const [a0, a1] = span(from);
    const [b0, b1] = span(to);
    const low = Math.max(a0, b0);
    const high = Math.min(a1, b1);
    return high - low >= 4 ? { low, high } : undefined;
};

/**
 * Paths for arrows between boxes, by key. Arrows on the same side of a shape spread along
 * it, in the order of where they go, so they don't cross there.
 */
const route = (edges: RouteEdge[], obstacles: RouteEnd[], areas: RouteArea[] = []) => {
    const sides = new Map(edges.map(edge => [edge.key, getSides(edge.from.box, edge.to.box)]));

    // Every arrow end on each side of each shape, ordered along the side by the other end
    const ends = new Map<string, { key: string; other: Point; isStart: boolean }[]>();
    edges.forEach(edge => {
        const [fromSide, toSide] = sides.get(edge.key)!;
        const add = (end: RouteEnd, side: Side, other: RouteEnd, isStart: boolean) => {
            const slot = `${end.id}:${side}`;
            ends.set(slot, [
                ...(ends.get(slot) ?? []),
                { key: edge.key, other: center(other.box), isStart },
            ]);
        };
        add(edge.from, fromSide, edge.to, true);
        add(edge.to, toSide, edge.from, false);
    });
    const offsets = new Map<string, number>();
    ends.forEach((list, slot) => {
        const side = slot.slice(slot.lastIndexOf(":") + 1) as Side;
        const edge = edges.find(other => other.key === list[0]!.key)!;
        const end = list[0]!.isStart ? edge.from : edge.to;
        const length = isHorizontal(side) ? end.box.height : end.box.width;
        const step = Math.min(28, (length * 0.6) / Math.max(list.length - 1, 1));
        list.sort((a, b) =>
            isHorizontal(side) ? a.other.y - b.other.y : a.other.x - b.other.x
        ).forEach((item, i) => {
            const offset = (i - (list.length - 1) / 2) * step;
            offsets.set(`${item.key}:${item.isStart ? "start" : "end"}`, offset);
        });
    });

    const taken: Segment[] = [];
    const paths = new Map<string, Point[]>();
    // Short arrows first, so the long ones go around them
    const ordered = [...edges].sort(
        (a, b) =>
            Math.hypot(
                center(a.from.box).x - center(a.to.box).x,
                center(a.from.box).y - center(a.to.box).y
            ) -
            Math.hypot(
                center(b.from.box).x - center(b.to.box).x,
                center(b.from.box).y - center(b.to.box).y
            )
    );
    // Where on each side arrows end already, so ends that move don't land on another
    const used = new Map<string, number[]>();
    edges.forEach(edge => {
        const [fromSide, toSide] = sides.get(edge.key)!;
        const note = (slot: string, offset: number | undefined) =>
            used.set(slot, [...(used.get(slot) ?? []), offset ?? 0]);
        note(`${edge.from.id}:${fromSide}`, offsets.get(`${edge.key}:start`));
        note(`${edge.to.id}:${toSide}`, offsets.get(`${edge.key}:end`));
    });

    ordered.forEach(edge => {
        const [fromSide, toSide] = sides.get(edge.key)!;
        const horizontal = isHorizontal(fromSide);
        let startOffset = offsets.get(`${edge.key}:start`) ?? 0;
        let endOffset = offsets.get(`${edge.key}:end`) ?? 0;

        // Shapes that face each other get a straight arrow, at the same height on both
        const shared = getSharedSpan(edge.from.box, edge.to.box, horizontal);
        if (shared) {
            const middle = (box: Box) => (horizontal ? center(box).y : center(box).x);
            const wanted =
                (middle(edge.from.box) + startOffset + middle(edge.to.box) + endOffset) / 2;
            const at = Math.max(shared.low, Math.min(shared.high, wanted));
            const nextStart = at - middle(edge.from.box);
            const nextEnd = at - middle(edge.to.box);
            const isFree = (slot: string, previous: number, next: number) =>
                (used.get(slot) ?? []).every(
                    offset => offset === previous || Math.abs(offset - next) >= 12
                );
            if (
                isFree(`${edge.from.id}:${fromSide}`, startOffset, nextStart) &&
                isFree(`${edge.to.id}:${toSide}`, endOffset, nextEnd)
            ) {
                startOffset = nextStart;
                endOffset = nextEnd;
            }
        }

        const p = getPort(edge.from, fromSide, startOffset);
        const q = getPort(edge.to, toSide, endOffset);
        const others = obstacles
            .filter(other => other.id !== edge.from.id && other.id !== edge.to.id)
            .map(other => pad(other.box, CLEARANCE));
        const avoid = areas
            .filter(area => !area.ids.has(edge.from.id) && !area.ids.has(edge.to.id))
            .map(area => area.box);
        const path = findPath(p, q, horizontal, others, taken, avoid);
        taken.push(...toSegments(path).slice(1, -1));
        paths.set(edge.key, path);
    });
    return paths;
};

/** One arrow's path, between the facing sides' middles */
const routeOne = (from: RouteEnd, to: RouteEnd, obstacles: RouteEnd[] = []) =>
    route([{ key: "edge", from, to }], obstacles).get("edge")!;

/**
 * The same path, with points added so its label sits in the middle of its longest flat
 * stretch. Excalidraw puts a label at the middle point, or the middle of the middle segment,
 * which on a path with corners is often a corner or a short vertical bit.
 */
const withLabelSpot = (points: Point[]): Point[] => {
    if (points.length < 3) return points;
    const segments = toSegments(points);
    const length = ([a, b]: Segment) => Math.hypot(b.x - a.x, b.y - a.y);
    const isFlat = ([a, b]: Segment) => Math.abs(a.y - b.y) < 1;
    const flat = segments.filter(isFlat);
    const longest = (
        flat.length && length(flat.reduce((m, n) => (length(n) > length(m) ? n : m))) >= 80
            ? flat
            : segments
    ).reduce((m, n) => (length(n) > length(m) ? n : m));
    const index = segments.indexOf(longest);
    const [a, b] = longest;
    const at = (t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

    // Points on the stretch either side of its middle, so the middle is the path's middle point
    const before = index + 1;
    const after = points.length - 1 - index;
    const extraBefore = Math.max(0, after - before);
    const extraAfter = Math.max(0, before - after);
    const fill = (from: number, to: number, count: number) =>
        Array.from({ length: count }, (_, i) => at(from + ((to - from) * (i + 1)) / (count + 1)));
    return [
        ...points.slice(0, index + 1),
        ...fill(0, 0.5, extraBefore),
        at(0.5),
        ...fill(0.5, 1, extraAfter),
        ...points.slice(index + 1),
    ];
};

/** The segments of a path, for checking what it crosses */
const getSegments = toSegments;

export const DiagramLayout = {
    layOut,
    route,
    routeOne,
    withLabelSpot,
    crosses,
    getSegments,
    center,
};
