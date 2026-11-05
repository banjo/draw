import { DiagramEdge, DiagramNode, DiagramSpec } from "../model/ai";
import { ExcalidrawElement, ExcalidrawTextElement } from "../model/excalidraw-element";
import { DiagramChange, DiagramChanges } from "../model/mcp";
import { LinkContent } from "./blocks";
import {
    DiagramBuilder,
    Drawn,
    FILLS,
    FRAME_PADDING,
    LABEL_FONT_SIZE,
    EDGE_LABEL_FONT_SIZE,
    STICKY_NOTE_STYLE,
    TEXT_SIZES,
} from "./diagram-builder";
import { DiagramReader } from "./diagram-reader";
import { ElementBounds } from "./element-bounds";
import { Box, ElementFactory } from "./element-factory";
import { EstimatedTextMetrics, TextMetrics } from "./text-metrics";

/**
 * Changes to a drawing, described as a diagram: nodes, edges and groups added, changed and
 * removed by id. Everything else stays where it is. The result is what changed, with new
 * versions, to send like any other change.
 */

export type DiagramEditResult =
    | {
          success: true;
          /** Changed and new elements */
          elements: ExcalidrawElement[];
          /** The element each new node is, and the frame each new group is, by the given id */
          ids: Record<string, string>;
          /** The arrow each new edge is, in the order they were given */
          edges: string[];
      }
    | { success: false; message: string };

type EditOptions = {
    metrics?: TextMetrics;
    getLinkContent?: (url: string) => Promise<LinkContent>;
};

class EditError extends Error {}

const fail = (message: string): never => {
    throw new EditError(message);
};

/** The fields each kind of node, an edge and a group can change, besides its id */
const CHANGEABLE: Record<DiagramNode["type"] | "edge" | "group", (keyof DiagramChange)[]> = {
    shape: ["label", "color", "shape"],
    sticky: ["label", "color"],
    text: ["label", "size"],
    note: ["markdown", "width"],
    table: ["rows", "headerRow", "headerColumn"],
    chart: ["rows", "chartType", "title"],
    code: ["code", "language"],
    link: ["url"],
    edge: ["label", "style", "heads"],
    group: ["label"],
};

type Binding = { elementId: string } | null | undefined;
type Arrow = ExcalidrawElement & {
    startBinding?: Binding;
    endBinding?: Binding;
    startArrowhead?: string | null;
    endArrowhead?: string | null;
};

const getBindings = (element: ExcalidrawElement) => {
    const arrow = element as Arrow;
    return [arrow.startBinding, arrow.endBinding].filter(
        (binding): binding is { elementId: string } => Boolean(binding)
    );
};

/** A drawing being changed: the elements as they are now, and what changed */
const createDraft = (scene: readonly ExcalidrawElement[], metrics: TextMetrics | undefined) => {
    const original = new Map(scene.map(element => [element.id, element]));
    const current = new Map(original);
    const changed = new Set<string>();
    const added: ExcalidrawElement[] = [];

    const get = (id: string) => {
        const element = current.get(id);
        return element && !element.isDeleted ? element : undefined;
    };
    const set = (element: ExcalidrawElement) => {
        current.set(element.id, element);
        if (original.has(element.id)) changed.add(element.id);
    };
    const add = (element: ExcalidrawElement) => {
        current.set(element.id, element);
        added.push(element);
    };
    const update = (id: string, changes: Partial<ExcalidrawElement>) => {
        const element = get(id);
        if (element) set({ ...element, ...changes } as ExcalidrawElement);
    };
    const remove = (id: string) => update(id, { isDeleted: true });

    const getLabelId = (container: ExcalidrawElement) =>
        container.boundElements?.find(bound => bound.type === "text" && get(bound.id))?.id;

    const unbind = (id: string, boundId: string) => {
        const element = get(id);
        if (!element?.boundElements?.some(bound => bound.id === boundId)) return;
        update(id, {
            boundElements: element.boundElements.filter(bound => bound.id !== boundId),
        });
    };

    const bind = (id: string, bound: { id: string; type: "arrow" | "text" }) => {
        const element = get(id);
        if (!element) return;
        const changes = { boundElements: [...(element.boundElements ?? []), bound] };
        // New elements change in place, as they have no version to bump yet
        const index = added.findIndex(other => other.id === id);
        if (index >= 0) {
            added[index] = { ...element, ...changes } as ExcalidrawElement;
            current.set(id, added[index]!);
        } else {
            update(id, changes);
        }
    };

    /** A shape's or an arrow's label: changed, added, or removed when it's empty */
    const setLabel = (id: string, text: string, fontSize: number) => {
        const container = get(id)!;
        const labelId = getLabelId(container);
        if (!text) {
            if (labelId) {
                remove(labelId);
                unbind(id, labelId);
            }
            return;
        }
        if (labelId) {
            const label = {
                ...get(labelId)!,
                text,
                originalText: text,
            } as ExcalidrawElement;
            const fitted = ElementFactory.fitLabel(
                label,
                container,
                metrics ?? EstimatedTextMetrics
            );
            set(DiagramBuilder.unmeasured(fitted, metrics));
            return;
        }
        const labelled = ElementFactory.label({
            container,
            text,
            fontSize,
            metrics: metrics ?? EstimatedTextMetrics,
        });
        set(labelled.container);
        add(
            DiagramBuilder.unmeasured(
                { ...labelled.label, frameId: container.frameId } as ExcalidrawElement,
                metrics
            )
        );
    };

    /** The changed elements with new versions, and the new ones */
    const getResult = () => [
        ...[...changed].map(id => ElementFactory.bump(current.get(id)!)),
        ...added.map(element => current.get(element.id)!),
    ];

    return { get, set, add, update, remove, getLabelId, unbind, bind, setLabel, getResult };
};

type Draft = ReturnType<typeof createDraft>;

type Current = {
    spec: DiagramSpec;
    nodes: Map<string, DiagramNode>;
    edges: Map<string, DiagramEdge>;
    groups: Set<string>;
};

const readCurrent = (scene: readonly ExcalidrawElement[]): Current => {
    const live = scene.filter(element => !element.isDeleted);
    const read = DiagramReader.read(live, live, { ids: "element" });
    const spec = read.spec ?? { direction: "right" as const, groups: [], nodes: [], edges: [] };
    return {
        spec,
        nodes: new Map(spec.nodes.map(node => [node.id, node])),
        edges: new Map(spec.edges.map((edge, i) => [read.arrowOf[i]!, edge])),
        groups: new Set(read.frameOf.values()),
    };
};

/** Checks the changes against the drawing before anything is changed */
const validate = (
    changes: DiagramChanges,
    current: Current,
    scene: readonly ExcalidrawElement[]
) => {
    const isKnown = (id: string) =>
        current.nodes.has(id) || current.edges.has(id) || current.groups.has(id);
    const removed = new Set(changes.remove ?? []);

    removed.forEach(id => !isKnown(id) && fail(`Unknown id: ${id}`));
    changes.update?.forEach(change => {
        if (!isKnown(change.id)) fail(`Unknown id: ${change.id}`);
        if (removed.has(change.id)) fail(`${change.id} is both changed and removed`);
    });

    const taken = new Set(scene.map(element => element.id));
    const add = changes.add ?? { groups: [], nodes: [], edges: [] };
    [...add.groups, ...add.nodes].forEach(({ id }) => {
        if (taken.has(id)) fail(`The id ${id} is taken: pick another for what you add`);
        taken.add(id);
    });

    const groups = new Set([
        ...[...current.groups].filter(id => !removed.has(id)),
        ...add.groups.map(group => group.id),
    ]);
    add.nodes.forEach(node => {
        if (node.group && !groups.has(node.group)) fail(`Unknown group: ${node.group}`);
    });

    const nodes = new Set([
        ...[...current.nodes.keys()].filter(id => !removed.has(id)),
        ...add.nodes.map(node => node.id),
    ]);
    add.edges.forEach(edge => {
        if (!nodes.has(edge.from)) fail(`Unknown node: ${edge.from}`);
        if (!nodes.has(edge.to)) fail(`Unknown node: ${edge.to}`);
        if (edge.from === edge.to) fail(`An edge can't go from ${edge.from} to itself`);
    });
};

const removeArrow = (draft: Draft, id: string) => {
    const arrow = draft.get(id);
    if (!arrow) return;
    const labelId = draft.getLabelId(arrow);
    draft.remove(id);
    if (labelId) draft.remove(labelId);
    getBindings(arrow).forEach(binding => draft.unbind(binding.elementId, id));
};

const removeNode = (
    draft: Draft,
    id: string,
    current: Current,
    scene: readonly ExcalidrawElement[]
) => {
    const node = draft.get(id);
    if (!node) return;
    const labelId = draft.getLabelId(node);
    draft.remove(id);
    if (labelId) draft.remove(labelId);

    scene
        .filter(element => element.type === "arrow" && draft.get(element.id))
        .forEach(element => {
            const arrow = draft.get(element.id) as Arrow;
            const isBound = getBindings(arrow).some(binding => binding.elementId === id);
            if (!isBound) return;
            if (current.edges.has(arrow.id)) {
                removeArrow(draft, arrow.id);
                return;
            }
            // Arrows that aren't edges stay, no longer bound to it
            draft.update(arrow.id, {
                ...(arrow.startBinding?.elementId === id ? { startBinding: null } : {}),
                ...(arrow.endBinding?.elementId === id ? { endBinding: null } : {}),
            } as Partial<ExcalidrawElement>);
        });
};

const removeGroup = (draft: Draft, id: string, scene: readonly ExcalidrawElement[]) => {
    draft.remove(id);
    scene
        .filter(element => element.frameId === id)
        .forEach(element => draft.update(element.id, { frameId: null }));
};

const checkFields = (change: DiagramChange, kind: keyof typeof CHANGEABLE) => {
    const allowed = new Set<string>(["id", ...CHANGEABLE[kind]]);
    Object.entries(change).forEach(([field, value]) => {
        if (value !== undefined && !allowed.has(field)) {
            fail(
                `${field} can't be changed on ${kind === "edge" || kind === "group" ? `an ${kind}` : `a ${kind}`} (${change.id})`
            );
        }
    });
};

const changeEdge = (draft: Draft, change: DiagramChange) => {
    checkFields(change, "edge");
    const arrow = draft.get(change.id) as Arrow;
    if (change.style) draft.update(change.id, { strokeStyle: change.style });
    if (change.heads) {
        // An arrow drawn the other way round keeps pointing the way it does
        const isReversed = Boolean(arrow.startArrowhead) && !arrow.endArrowhead;
        const forward = change.heads !== "none" ? "arrow" : null;
        const backward = change.heads === "both" ? "arrow" : null;
        draft.update(change.id, {
            startArrowhead: isReversed ? forward : backward,
            endArrowhead: isReversed ? backward : forward,
        } as Partial<ExcalidrawElement>);
    }
    if (change.label !== undefined) {
        draft.setLabel(change.id, change.label, EDGE_LABEL_FONT_SIZE);
    }
};

/** Bigger, when its new label needs more room; it never shrinks */
const growShape = (draft: Draft, id: string, size: { width: number; height: number }) => {
    const element = draft.get(id)!;
    if (size.width <= element.width && size.height <= element.height) return;
    const width = Math.max(element.width, size.width);
    const height = Math.max(element.height, size.height);
    // Around its middle, so it takes a little room on every side rather than a lot on one
    draft.update(id, {
        x: element.x - (width - element.width) / 2,
        y: element.y - (height - element.height) / 2,
        width,
        height,
    });
};

const changeShape = (
    draft: Draft,
    change: DiagramChange,
    node: Extract<DiagramNode, { type: "shape" }>
) => {
    checkFields(change, "shape");
    const shape = change.shape ?? node.shape;
    const label = change.label ?? node.label ?? "";

    if (change.shape) {
        const { type, roundness, customData } = DiagramBuilder.shapeStyle(shape, undefined);
        draft.update(change.id, { type, roundness, customData } as Partial<ExcalidrawElement>);
    }
    if (change.color !== undefined) {
        draft.update(change.id, {
            backgroundColor: change.color ? FILLS[change.color] : "transparent",
            fillStyle: "solid",
        });
    }
    if (change.shape || change.label !== undefined) {
        growShape(draft, change.id, DiagramBuilder.getShapeSize(shape, label));
        // Its label moves to the middle of its new size
        draft.setLabel(change.id, label, LABEL_FONT_SIZE);
    }
};

const changeSticky = (
    draft: Draft,
    change: DiagramChange,
    node: Extract<DiagramNode, { type: "sticky" }>
) => {
    checkFields(change, "sticky");
    if (change.color !== undefined) {
        draft.update(change.id, {
            backgroundColor: change.color ? FILLS[change.color] : STICKY_NOTE_STYLE.backgroundColor,
        });
    }
    if (change.label !== undefined) {
        const size = DiagramBuilder.getStickySize(change.label);
        growShape(draft, change.id, { width: size, height: size });
        draft.setLabel(change.id, change.label || node.text, LABEL_FONT_SIZE);
    }
};

const changeText = (draft: Draft, change: DiagramChange, metrics: TextMetrics | undefined) => {
    checkFields(change, "text");
    const element = draft.get(change.id) as ExcalidrawTextElement;
    const text = change.label ?? element.originalText;
    const fontSize = change.size ? TEXT_SIZES[change.size] : element.fontSize;
    const size = (metrics ?? EstimatedTextMetrics).measure(text, fontSize);
    const changed = { ...element, text, originalText: text, fontSize, ...size };
    draft.set(DiagramBuilder.unmeasured(changed as ExcalidrawElement, metrics));
};

/** A block drawn again from its new content, where it was */
const changeBlock = async (
    draft: Draft,
    change: DiagramChange,
    node: DiagramNode,
    options: EditOptions
) => {
    checkFields(change, node.type);
    const { id: _, ...fields } = change;
    const next = { ...node, ...fields } as DiagramNode;
    const drawn = await DiagramBuilder.drawNode(next, options);
    const [block] = drawn.elements as (ExcalidrawElement & { fileId?: string })[];
    draft.update(change.id, {
        width: block!.width,
        height: block!.height,
        fileId: block!.fileId,
        customData: block!.customData,
    } as Partial<ExcalidrawElement>);
};

const applyChange = async (
    draft: Draft,
    change: DiagramChange,
    current: Current,
    options: EditOptions
) => {
    if (current.edges.has(change.id)) {
        changeEdge(draft, change);
        return;
    }
    if (current.groups.has(change.id)) {
        checkFields(change, "group");
        if (change.label !== undefined) {
            draft.update(change.id, { name: change.label } as Partial<ExcalidrawElement>);
        }
        return;
    }
    const node = current.nodes.get(change.id)!;
    switch (node.type) {
        case "shape":
            return changeShape(draft, change, node);
        case "sticky":
            return changeSticky(draft, change, node);
        case "text":
            return changeText(draft, change, options.metrics);
        default:
            return changeBlock(draft, change, node, options);
    }
};

/** What new nodes have to stay clear of: everything but arrows, labels and frames */
const getObstacles = (draft: Draft, scene: readonly ExcalidrawElement[]) => {
    const boxes = new Map<string, Box>();
    scene.forEach(({ id }) => {
        const element = draft.get(id);
        if (!element || element.type === "arrow" || element.type === "frame") return;
        if (element.type === "text" && (element as ExcalidrawTextElement).containerId) return;
        boxes.set(id, ElementBounds.getBox(element));
    });
    return boxes;
};

const intersects = (a: Box, b: Box) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const pad = (box: Box, by: number): Box => ({
    x: box.x - by,
    y: box.y - by,
    width: box.width + by * 2,
    height: box.height + by * 2,
});

const union = (a: Box, b: Box): Box => {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const right = Math.max(a.x + a.width, b.x + b.width);
    const bottom = Math.max(a.y + a.height, b.y + b.height);
    return { x, y, width: right - x, height: bottom - y };
};

/**
 * Where a new node can go: out of groups it isn't in, and, in a group that's there, only
 * where the group can grow to it without covering what's outside it
 */
const createIsFree = (
    draft: Draft,
    scene: readonly ExcalidrawElement[],
    groupOf: Map<string, string | undefined>
) => {
    const frames = scene
        .map(({ id }) => draft.get(id))
        .filter((element): element is ExcalidrawElement => element?.type === "frame");
    const outsiders = [...getObstacles(draft, scene)].map(([id, box]) => ({
        frameId: draft.get(id)?.frameId ?? null,
        box,
    }));

    return (id: string, box: Box) => {
        const frameId = groupOf.get(id);
        const frame = frames.find(other => other.id === frameId);
        if (!frame) {
            return !frames.some(other => intersects(pad(box, 20), ElementBounds.getBox(other)));
        }
        const grown = union(ElementBounds.getBox(frame), pad(box, FRAME_PADDING));
        return (
            !frames.some(
                other => other.id !== frameId && intersects(grown, ElementBounds.getBox(other))
            ) && !outsiders.some(other => other.frameId !== frameId && intersects(grown, other.box))
        );
    };
};

/** Grows a frame to hold what's in it, with room around */
const fitFrame = (
    draft: Draft,
    frameId: string,
    scene: readonly ExcalidrawElement[],
    added: ExcalidrawElement[]
) => {
    const frame = draft.get(frameId);
    if (!frame) return;
    const members = [...scene, ...added]
        .map(element => draft.get(element.id))
        .filter((element): element is ExcalidrawElement => element?.frameId === frameId);
    if (members.length === 0) return;
    const [minX, minY, maxX, maxY] = ElementBounds.getCommonBounds(members);
    const x = Math.min(frame.x, minX - FRAME_PADDING);
    const y = Math.min(frame.y, minY - FRAME_PADDING);
    const right = Math.max(frame.x + frame.width, maxX + FRAME_PADDING);
    const bottom = Math.max(frame.y + frame.height, maxY + FRAME_PADDING);
    if (
        x === frame.x &&
        y === frame.y &&
        right === frame.x + frame.width &&
        bottom === frame.y + frame.height
    ) {
        return;
    }
    draft.update(frameId, { x, y, width: right - x, height: bottom - y });
};

/** An arrow's ends, and everything else it should go around */
const getArrowEnds = (
    draft: Draft,
    scene: readonly ExcalidrawElement[],
    from: ExcalidrawElement,
    to: ExcalidrawElement
) => {
    const obstacles = [...getObstacles(draft, scene)]
        .filter(([id]) => id !== from.id && id !== to.id)
        .map(([, box]) => box);
    const end = (element: ExcalidrawElement) => ({
        id: element.id,
        box: ElementBounds.getBox(element),
        outline: DiagramBuilder.getOutline(element),
    });
    return { from: end(from), to: end(to), obstacles };
};

/**
 * Arrows to shapes that changed size, drawn straight again between their new edges, so they
 * don't end inside them. Their labels move with them.
 */
const rerouteArrows = (draft: Draft, scene: readonly ExcalidrawElement[]) => {
    const isResized = (id: string) => {
        const before = scene.find(element => element.id === id);
        const after = draft.get(id);
        return Boolean(
            before && after && (before.width !== after.width || before.height !== after.height)
        );
    };
    scene.forEach(({ id }) => {
        const arrow = draft.get(id) as Arrow | undefined;
        if (arrow?.type !== "arrow" || !arrow.startBinding || !arrow.endBinding) return;
        const from = draft.get(arrow.startBinding.elementId);
        const to = draft.get(arrow.endBinding.elementId);
        if (!from || !to || !(isResized(from.id) || isResized(to.id))) return;

        const labelId = draft.getLabelId(arrow);
        const label = labelId ? (draft.get(labelId) as ExcalidrawTextElement) : undefined;
        const [drawn, drawnLabel] = DiagramBuilder.drawArrow({
            edge: { label: label?.originalText },
            ...getArrowEnds(draft, scene, from, to),
        });
        const { x, y, width, height, points } = drawn as ExcalidrawElement & { points: unknown };
        draft.update(id, { x, y, width, height, points } as Partial<ExcalidrawElement>);
        if (label && drawnLabel) {
            draft.update(label.id, {
                x: drawnLabel.x + (drawnLabel.width - label.width) / 2,
                y: drawnLabel.y + (drawnLabel.height - label.height) / 2,
            });
        }
    });
};

const sizeOf = ({ width, height }: Drawn) => ({ width, height });

const addAll = async (
    draft: Draft,
    changes: DiagramChanges,
    current: Current,
    scene: readonly ExcalidrawElement[],
    options: EditOptions
) => {
    const add = changes.add ?? { groups: [], nodes: [], edges: [] };
    const ids: Record<string, string> = {};
    const arrows: string[] = [];
    if (add.nodes.length === 0 && add.edges.length === 0) return { ids, edges: arrows };

    const drawn = new Map<string, Drawn>();
    await Promise.all(
        add.nodes.map(async node =>
            drawn.set(node.id, await DiagramBuilder.drawNode(node, options))
        )
    );

    // New nodes in a group that's there go next to what's in it, unless they're connected
    const edgesForPlacing = [...add.edges];
    add.nodes.forEach(node => {
        if (!node.group || !current.groups.has(node.group)) return;
        if (add.edges.some(edge => edge.from === node.id || edge.to === node.id)) return;
        const member = scene.find(
            element =>
                element.frameId === node.group &&
                current.nodes.has(element.id) &&
                draft.get(element.id)
        );
        if (member) edgesForPlacing.push({ from: member.id, to: node.id });
    });

    const boxes = DiagramBuilder.placeNew({
        direction: current.spec.direction,
        nodes: add.nodes.map(node => ({ id: node.id, ...sizeOf(drawn.get(node.id)!) })),
        edges: edgesForPlacing,
        placed: getObstacles(draft, scene),
        isFree: createIsFree(
            draft,
            scene,
            new Map(
                add.nodes.map(node => [
                    node.id,
                    node.group && current.groups.has(node.group) ? node.group : undefined,
                ])
            )
        ),
    });

    const elementsOf = new Map<string, ExcalidrawElement[]>();
    add.nodes.forEach(node => {
        const box = boxes.get(node.id)!;
        const frameId = node.group && current.groups.has(node.group) ? node.group : null;
        const elements = DiagramBuilder.move(drawn.get(node.id)!.elements, box.x, box.y).map(
            element => ({ ...element, frameId }) as ExcalidrawElement
        );
        elementsOf.set(node.id, elements);
        elements.forEach(draft.add);
        ids[node.id] = elements[0]!.id;
    });

    const elementId = (id: string) => ids[id] ?? id;
    const groupOf = (id: string) =>
        add.nodes.find(node => node.id === id)?.group ?? draft.get(id)?.frameId ?? undefined;
    const arrowsOf = new Map<string, ExcalidrawElement[]>();

    add.edges.forEach(edge => {
        const from = draft.get(elementId(edge.from))!;
        const to = draft.get(elementId(edge.to))!;
        const elements = DiagramBuilder.drawArrow({
            edge,
            ...getArrowEnds(draft, [...scene, ...[...elementsOf.values()].flat()], from, to),
            metrics: options.metrics,
        });
        const group = groupOf(edge.from);
        const isInside = group !== undefined && group === groupOf(edge.to);
        const frameId = isInside && current.groups.has(group) ? group : null;
        const placed = elements.map(element => ({ ...element, frameId }) as ExcalidrawElement);
        placed.forEach(draft.add);
        arrowsOf.set(placed[0]!.id, placed);
        draft.bind(from.id, { id: placed[0]!.id, type: "arrow" });
        draft.bind(to.id, { id: placed[0]!.id, type: "arrow" });
        arrows.push(placed[0]!.id);
    });

    // New groups: frames around their new nodes, and the arrows between them
    add.groups.forEach(group => {
        const members = add.nodes.filter(node => node.group === group.id);
        if (members.length === 0) return;
        const memberIds = new Set(members.map(node => ids[node.id]!));
        const inside = arrows
            .map(id => draft.get(id) as Arrow)
            .filter(arrow => getBindings(arrow).every(binding => memberIds.has(binding.elementId)))
            .flatMap(arrow => arrowsOf.get(arrow.id)!);
        const children = [
            ...members.flatMap(node =>
                elementsOf.get(node.id)!.map(element => draft.get(element.id)!)
            ),
            ...inside.map(element => draft.get(element.id)!),
        ];
        const { frame, framed } = DiagramBuilder.drawFrame(group.label, children);
        framed.forEach(element => draft.set(element));
        draft.add(frame);
        ids[group.id] = frame.id;
    });

    // Groups that were there grow to hold their new nodes
    const addedElements = [...elementsOf.values()].flat();
    new Set(add.nodes.map(node => node.group).filter(id => id && current.groups.has(id))).forEach(
        frameId => fitFrame(draft, frameId!, scene, addedElements)
    );

    return { ids, edges: arrows };
};

/** The drawing's elements with the changes applied: only what changed, with new versions */
const apply = async (
    scene: readonly ExcalidrawElement[],
    changes: DiagramChanges,
    options: EditOptions = {}
): Promise<DiagramEditResult> => {
    try {
        const current = readCurrent(scene);
        validate(changes, current, scene);
        const draft = createDraft(scene, options.metrics);

        for (const id of changes.remove ?? []) {
            if (current.edges.has(id)) removeArrow(draft, id);
            else if (current.groups.has(id)) removeGroup(draft, id, scene);
            else removeNode(draft, id, current, scene);
        }
        for (const change of changes.update ?? []) {
            await applyChange(draft, change, current, options);
        }
        rerouteArrows(draft, scene);
        // Groups grow to hold shapes that grew
        new Set(
            (changes.update ?? []).map(change => draft.get(change.id)?.frameId).filter(Boolean)
        ).forEach(frameId => fitFrame(draft, frameId!, scene, []));
        const { ids, edges } = await addAll(draft, changes, current, scene, options);

        return { success: true, elements: draft.getResult(), ids, edges };
    } catch (error) {
        if (error instanceof EditError) return { success: false, message: error.message };
        throw error;
    }
};

export const DiagramEditor = { apply };
