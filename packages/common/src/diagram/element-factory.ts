import { ExcalidrawElement } from "../model/excalidraw-element";
import { CustomData } from "../model/excalidraw-custom-data";
import { Random } from "./random";
import { FONT_FAMILY, LINE_HEIGHT, TextMetrics } from "./text-metrics";

/**
 * Complete Excalidraw elements without Excalidraw, which only runs in a browser. They have
 * every field Excalidraw's own have, as the app shows elements from the API as they are.
 */

export type Point = { x: number; y: number };
export type Box = Point & { width: number; height: number };

type Roundness = { type: number; value?: number } | null;
type StrokeStyle = "solid" | "dashed" | "dotted";
type Arrowhead = "arrow" | null;

type Style = {
    strokeColor?: string;
    backgroundColor?: string;
    fillStyle?: "solid" | "hachure" | "cross-hatch" | "zigzag";
    strokeStyle?: StrokeStyle;
    roundness?: Roundness;
};

// Excalidraw's padding around a label in its shape, and how wide an arrow's label can be
const BOUND_TEXT_PADDING = 5;
const ARROW_LABEL_WIDTH_FRACTION = 0.7;
const ARROW_LABEL_MIN_WIDTH_RATIO = 11;

const base = (type: string, box: Box, style: Style = {}) => ({
    id: Random.id(),
    type,
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    angle: 0,
    strokeColor: style.strokeColor ?? "#1e1e1e",
    backgroundColor: style.backgroundColor ?? "transparent",
    fillStyle: style.fillStyle ?? "solid",
    strokeWidth: 2,
    strokeStyle: style.strokeStyle ?? "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    // Excalidraw gives each element its place in the order when it gets them
    index: null,
    roundness: style.roundness ?? null,
    seed: Random.integer(),
    version: 1,
    versionNonce: Random.integer(),
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
});

const asElement = (element: object) => element as unknown as ExcalidrawElement;

type ShapeProps = Box &
    Style & {
        type: "rectangle" | "ellipse" | "diamond";
        customData: CustomData;
    };

const shape = ({ type, customData, ...props }: ShapeProps) =>
    asElement({ ...base(type, props, props), customData });

type TextProps = Point & {
    text: string;
    fontSize: number;
    metrics: TextMetrics;
    customData?: CustomData;
};

/** Text on its own, which grows with what's written */
const text = ({ x, y, text: content, fontSize, metrics, customData }: TextProps) => {
    const { width, height } = metrics.measure(content, fontSize);
    return asElement({
        ...base("text", { x, y, width, height }),
        text: content,
        fontSize,
        fontFamily: FONT_FAMILY,
        textAlign: "left",
        verticalAlign: "top",
        containerId: null,
        originalText: content,
        autoResize: true,
        lineHeight: LINE_HEIGHT,
        ...(customData ? { customData } : {}),
    });
};

type Linear = ExcalidrawElement & { points: readonly (readonly [number, number])[] };

const isLinear = (element: ExcalidrawElement): element is Linear =>
    element.type === "arrow" || element.type === "line";

/** Where a label goes on an arrow: its middle point, or the middle of its middle segment */
const getArrowMiddle = (arrow: Linear): Point => {
    const { points } = arrow;
    const at = (i: number) => ({ x: arrow.x + points[i]![0], y: arrow.y + points[i]![1] });
    if (points.length % 2 === 1) return at(Math.floor(points.length / 2));
    const a = at(points.length / 2 - 1);
    const b = at(points.length / 2);
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
};

/** How wide a label can be in its shape or on its arrow, like Excalidraw */
const getLabelMaxWidth = (container: ExcalidrawElement, fontSize: number) => {
    if (isLinear(container)) {
        return Math.max(
            ARROW_LABEL_WIDTH_FRACTION * container.width,
            fontSize * ARROW_LABEL_MIN_WIDTH_RATIO
        );
    }
    if (container.type === "ellipse") {
        return Math.round((container.width / 2) * Math.sqrt(2)) - BOUND_TEXT_PADDING * 2;
    }
    if (container.type === "diamond") {
        return Math.round(container.width / 2) - BOUND_TEXT_PADDING * 2;
    }
    return container.width - BOUND_TEXT_PADDING * 2;
};

/** Where a label's center is: the middle of its shape, or of its arrow */
const getLabelCenter = (container: ExcalidrawElement): Point =>
    isLinear(container)
        ? getArrowMiddle(container)
        : { x: container.x + container.width / 2, y: container.y + container.height / 2 };

type LabelProps = {
    container: ExcalidrawElement;
    text: string;
    fontSize: number;
    metrics: TextMetrics;
};

/** A label in the middle of a shape or an arrow, and the container that knows about it */
const label = ({ container, text: content, fontSize, metrics }: LabelProps) => {
    const wrapped = metrics.wrap(content, fontSize, getLabelMaxWidth(container, fontSize));
    const { width, height } = metrics.measure(wrapped, fontSize);
    const center = getLabelCenter(container);
    const element = asElement({
        ...base("text", { x: center.x - width / 2, y: center.y - height / 2, width, height }),
        text: wrapped,
        fontSize,
        fontFamily: FONT_FAMILY,
        textAlign: "center",
        verticalAlign: "middle",
        containerId: container.id,
        originalText: content,
        autoResize: true,
        lineHeight: LINE_HEIGHT,
    });
    const withLabel = {
        ...container,
        boundElements: [...(container.boundElements ?? []), { type: "text", id: element.id }],
    } as ExcalidrawElement;
    return { container: withLabel, label: element };
};

/** A label's place and size again, after its text or container changed */
const fitLabel = (
    labelElement: ExcalidrawElement,
    container: ExcalidrawElement,
    metrics: TextMetrics
) => {
    const textElement = labelElement as ExcalidrawElement & {
        originalText: string;
        fontSize: number;
    };
    const wrapped = metrics.wrap(
        textElement.originalText,
        textElement.fontSize,
        getLabelMaxWidth(container, textElement.fontSize)
    );
    const { width, height } = metrics.measure(wrapped, textElement.fontSize);
    const center = getLabelCenter(container);
    return {
        ...labelElement,
        text: wrapped,
        x: center.x - width / 2,
        y: center.y - height / 2,
        width,
        height,
    } as ExcalidrawElement;
};

type Binding = { elementId: string; focus: number; gap: number };

type ArrowProps = {
    /** In the canvas's coordinates, from start to end */
    points: Point[];
    strokeStyle?: StrokeStyle;
    startArrowhead?: Arrowhead;
    endArrowhead?: Arrowhead;
    startBinding?: Binding | null;
    endBinding?: Binding | null;
    customData?: CustomData;
};

/** The box around points relative to the first one, which is at 0,0 */
const getPointsSize = (points: (readonly [number, number])[]) => {
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    return {
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
    };
};

const arrow = ({
    points,
    strokeStyle,
    startArrowhead = null,
    endArrowhead = "arrow",
    startBinding = null,
    endBinding = null,
    customData = CustomData.createDefault({ shadow: false, type: "arrow" }),
}: ArrowProps) => {
    const [start] = points;
    const relative = points.map(point => [point.x - start!.x, point.y - start!.y] as const);
    return asElement({
        ...base(
            "arrow",
            { x: start!.x, y: start!.y, ...getPointsSize(relative) },
            // Sharp corners: a curve through the points would swing past them
            { strokeStyle, roundness: null }
        ),
        points: relative,
        lastCommittedPoint: null,
        startBinding,
        endBinding,
        startArrowhead,
        endArrowhead,
        elbowed: false,
        customData,
    });
};

const frame = ({ name, ...box }: Box & { name: string }) =>
    asElement({ ...base("frame", box), name });

type ImageProps = Box & { fileId: string; customData: CustomData };

/** An image, like a block's, whose file every browser makes from its customData */
const image = ({ fileId, customData, ...box }: ImageProps) =>
    asElement({
        ...base("image", box, { strokeColor: "transparent" }),
        status: "pending",
        fileId,
        scale: [1, 1],
        crop: null,
        customData,
    });

/** Changed: a new version and nonce, so the change wins over the copies others have */
const bump = <T extends ExcalidrawElement>(element: T, changes: Partial<T> = {}): T => ({
    ...element,
    ...changes,
    version: element.version + 1,
    versionNonce: Random.integer(),
    updated: Date.now(),
});

export const ElementFactory = {
    shape,
    text,
    label,
    fitLabel,
    arrow,
    frame,
    image,
    bump,
    isLinear,
};
