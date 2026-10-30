import { Chart } from "@/features/chart/models/chart";
import { CustomDataUtil } from "@/features/draw/utils/custom-data-util";
import { ExcalidrawUtil } from "@/features/draw/utils/excalidraw-util";
import { LinkCard } from "@/features/link-card/models/link-card";
import { MarkdownNote, NOTE_WIDTHS } from "@/features/markdown-note/models/markdown-note";
import { MermaidBlock } from "@/features/mermaid/models/mermaid-block";
import { CodeBlockImage } from "@/features/selected-element-visuals/models/code-block-image";
import { SwimlaneLayout } from "@/features/swimlane/models/swimlane-layout";
import { Table } from "@/features/table/models/table";
import {
    DIAGRAM_COLORS,
    DiagramColor,
    DiagramEdge,
    DiagramGroup,
    DiagramNode,
    DiagramShape,
    DiagramSpec,
    ExcalidrawElement,
} from "common";
import { FILLS, Point } from "./diagram-builder";

export type Selection = {
    /** What's selected, as a diagram, when there are shapes or blocks in it */
    spec: DiagramSpec | undefined;
    /** A Mermaid block selected on its own */
    mermaid: { id: string; definition: string } | undefined;
    /** Where each node was, to keep it there */
    positions: Map<string, Point>;
    /** The elements the result takes the place of */
    replaces: string[];
    /** Which node each shape or block became, to connect arrows from outside to it again */
    nodeOf: Map<string, string>;
    /** The frame everything selected is in, which the result goes in too */
    frameId: string | undefined;
    /** Where the selection was: its top left corner */
    origin: Point;
    /** How many selected things the AI can't see, like drawings and images */
    skipped: number;
    /** What's selected, in a few words */
    summary: string;
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

const toRgb = (hex: string) => {
    const value = parseInt(hex.replace("#", "").slice(0, 6), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255] as const;
};

/** The diagram color closest to a fill, or none for no fill */
const toColor = (fill: string): DiagramColor | undefined => {
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
type Content = DiagramNode extends infer N
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

const readNode = (element: ExcalidrawElement, label: string | undefined): Content | undefined => {
    const type = element.customData?.type;

    if (ExcalidrawUtil.isImageElement(element)) {
        if (CustomDataUtil.isMarkdownNote(element)) {
            const { markdown, width } = MarkdownNote.getContent(element);
            const sizes = ["S", "M", "L"] as const;
            const size = sizes.find(name => width <= NOTE_WIDTHS[name]) ?? "L";
            return { type: "note", markdown, width: size };
        }
        if (CustomDataUtil.isTable(element)) {
            const { rows, headerRow, headerColumn } = Table.getContent(element);
            return { type: "table", rows, headerRow, headerColumn };
        }
        if (CustomDataUtil.isChart(element)) {
            const { rows, chartType, title } = Chart.getContent(element);
            return { type: "chart", rows, chartType, title: title || undefined };
        }
        if (CustomDataUtil.isCodeBlockElement(element)) {
            const { code, language } = CodeBlockImage.getContent(element);
            return { type: "code", code, language };
        }
        if (CustomDataUtil.isLinkCard(element)) {
            return { type: "link", url: LinkCard.getContent(element).url };
        }
        return undefined;
    }

    if (ExcalidrawUtil.isTextElement(element)) {
        const size = getTextSize(element.fontSize);
        return { type: "text", text: element.originalText ?? element.text, size };
    }

    if (element.type !== "rectangle" && element.type !== "ellipse" && element.type !== "diamond") {
        return undefined;
    }
    if (CustomDataUtil.isAnyModelElement(element)) return undefined;

    const fill = element.backgroundColor;
    if (type === "sticky-note") {
        const color = fill.toLowerCase() === STICKY_FILL ? undefined : toColor(fill);
        return { type: "sticky", text: label ?? "", ...(color ? { color } : {}) };
    }

    const shape: DiagramShape =
        (type && SHAPE_TYPES[type]) ??
        (element.type === "rectangle" && element.roundness ? "rounded" : element.type);
    const color = toColor(fill);
    return {
        type: "shape",
        shape,
        ...(label ? { label } : {}),
        ...(color ? { color } : {}),
    };
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * What's selected, as a diagram the AI can change. Bound text goes with its shape, a frame
 * brings what's in it, and arrows between selected things come along. What a diagram can't
 * hold, like drawings and images, is left out and stays where it is.
 */
const read = (
    selected: readonly ExcalidrawElement[],
    scene: readonly ExcalidrawElement[]
): Selection => {
    const byId = new Map(scene.map(element => [element.id, element]));
    const ids = new Set(selected.map(element => element.id));

    // A selected frame brings what's in it
    scene.forEach(element => {
        if (element.frameId && ids.has(element.frameId)) ids.add(element.id);
    });

    const elements = scene.filter(element => ids.has(element.id) && !element.isDeleted);
    const labelOf = (element: ExcalidrawElement) => {
        const text = element.boundElements?.find(bound => bound.type === "text");
        const textElement = text ? byId.get(text.id) : undefined;
        return textElement && ExcalidrawUtil.isTextElement(textElement)
            ? (textElement.originalText ?? textElement.text)
            : undefined;
    };

    const mermaidBlocks = elements.filter(CustomDataUtil.isMermaidElement);
    const frames = elements.filter(
        element => element.type === "frame" && !SwimlaneLayout.isSwimlane(element)
    );

    const used = new Set<string>();
    const makeId = (base: string, fallback: string) => {
        let id = slug(base) || fallback;
        for (let i = 2; used.has(id); i++) id = `${slug(base) || fallback}-${i}`;
        used.add(id);
        return id;
    };

    const groups: DiagramGroup[] = [];
    const groupIds = new Map<string, string>();
    frames.forEach((frame, i) => {
        const label = (frame as { name?: string | null }).name ?? `Group ${i + 1}`;
        const id = makeId(label, `group-${i + 1}`);
        groups.push({ id, label });
        groupIds.set(frame.id, id);
    });

    const nodes: DiagramNode[] = [];
    const nodeIds = new Map<string, string>();
    const positions = new Map<string, Point>();
    const replaces = new Set<string>(frames.map(frame => frame.id));
    let skipped = 0;

    elements.forEach(element => {
        if (SwimlaneLayout.isPart(element)) return;
        if (SwimlaneLayout.isSwimlane(element)) skipped += 1;
        if (element.type === "frame" || element.type === "arrow") return;
        // Text on a shape or an arrow is part of it
        if (ExcalidrawUtil.isTextElement(element) && element.containerId) return;
        if (CustomDataUtil.isMermaidElement(element)) return;

        const content = readNode(element, labelOf(element));
        if (!content) {
            skipped += 1;
            return;
        }
        const label = ("label" in content && content.label) || ("text" in content && content.text);
        const id = makeId(label || "", `${content.type}-${nodes.length + 1}`);
        const group = element.frameId ? groupIds.get(element.frameId) : undefined;
        nodes.push({ ...content, id, ...(group ? { group } : {}) } as DiagramNode);
        nodeIds.set(element.id, id);
        positions.set(id, { x: element.x, y: element.y });
        replaces.add(element.id);
        element.boundElements?.forEach(bound => bound.type === "text" && replaces.add(bound.id));
    });

    // Arrows from and to selected things, selected or not
    const edges: DiagramEdge[] = [];
    scene.forEach(element => {
        if (element.type !== "arrow" || element.isDeleted) return;
        const arrow = element as ExcalidrawElement & {
            startBinding?: { elementId: string } | null;
            endBinding?: { elementId: string } | null;
            startArrowhead?: string | null;
            endArrowhead?: string | null;
        };
        const from = arrow.startBinding && nodeIds.get(arrow.startBinding.elementId);
        const to = arrow.endBinding && nodeIds.get(arrow.endBinding.elementId);
        if (!from || !to) {
            if (ids.has(element.id)) skipped += 1;
            return;
        }
        const label = labelOf(element);
        const heads = getHeads(arrow.startArrowhead, arrow.endArrowhead);
        edges.push({
            from: arrow.endArrowhead || !arrow.startArrowhead ? from : to,
            to: arrow.endArrowhead || !arrow.startArrowhead ? to : from,
            ...(label ? { label } : {}),
            ...(element.strokeStyle !== "solid" ? { style: element.strokeStyle } : {}),
            ...(heads ? { heads } : {}),
        });
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
                  definition: MermaidBlock.getDefinition(mermaidBlocks[0]!),
              }
            : undefined;
    if (mermaid) replaces.add(mermaid.id);
    else skipped += mermaidBlocks.length;

    const replaced = scene.filter(element => replaces.has(element.id));
    const [minX, minY] = replaced.length ? ExcalidrawUtil.getCommonBounds(replaced) : [0, 0];

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
        replaces: [...replaces],
        nodeOf: nodeIds,
        frameId: isInOneFrame ? frameId : undefined,
        origin: { x: minX, y: minY },
        skipped,
        summary: parts.join(", "),
    };
};

export const DiagramReader = { read };
