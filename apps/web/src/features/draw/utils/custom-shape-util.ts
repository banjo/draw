import { CustomShapeType } from "common";
import type { Drawable, Options } from "roughjs/bin/core";
import type { RoughGenerator } from "roughjs/bin/generator";

type Point = [number, number];

type Geometry = {
    /** The outline, filled and stroked */
    path: string;
    /** Lines inside the outline, only stroked, like a cylinder's rim */
    detail?: string;
    /** Where it's clicked, in its own coordinates. The box, when left out. */
    outline?: Point[];
};

/** The shapes drawn by the patch, as rectangles of another shape; a circle is an ellipse */
export type DrawnShapeType = Exclude<CustomShapeType, "circle">;

const DRAWN_SHAPE_TYPES: DrawnShapeType[] = [
    "pill",
    "triangle",
    "hexagon",
    "star",
    "parallelogram",
    "cylinder",
    "document",
    "cloud",
    "sticky-note",
];

const isDrawnShapeType = (type: unknown): type is DrawnShapeType =>
    DRAWN_SHAPE_TYPES.includes(type as DrawnShapeType);

const toPath = (points: Point[]) => `M ${points.map(([x, y]) => `${x} ${y}`).join(" L ")} Z`;

const polygon = (points: Point[]): Geometry => ({ path: toPath(points), outline: points });

type Curve = [Point, Point, Point];

const curvePoint = (from: Point, [c1, c2, to]: Curve, t: number): Point => {
    const u = 1 - t;
    const at = (i: 0 | 1) =>
        u * u * u * from[i] + 3 * u * u * t * c1[i] + 3 * u * t * t * c2[i] + t * t * t * to[i];
    return [at(0), at(1)];
};

/** A closed path of curves, with points along it to click */
const curves = (start: Point, segments: Curve[]): Geometry => {
    let from = start;
    const outline: Point[] = [];
    for (const segment of segments) {
        for (let step = 0; step < 4; step++) outline.push(curvePoint(from, segment, step / 4));
        from = segment[2];
    }
    const path = segments.map(
        ([c1, c2, to]) => `C ${c1.join(" ")}, ${c2.join(" ")}, ${to.join(" ")}`
    );
    return { path: `M ${start.join(" ")} ${path.join(" ")} Z`, outline };
};

/** Two half circles joined by straight lines */
const pill = (width: number, height: number): Geometry => {
    const r = Math.min(width, height) / 2;
    const steps = 8;
    const arc = (cx: number, cy: number, from: number) =>
        Array.from({ length: steps + 1 }, (_, i): Point => {
            const angle = from + (Math.PI * i) / steps;
            return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
        });
    const tall = height > width;
    const outline = tall
        ? [...arc(r, height - r, 0), ...arc(r, r, Math.PI)]
        : [...arc(width - r, r, -Math.PI / 2), ...arc(r, r, Math.PI / 2)];
    const path = tall
        ? `M 0 ${r} A ${r} ${r} 0 0 1 ${width} ${r} L ${width} ${height - r} A ${r} ${r} 0 0 1 0 ${height - r} Z`
        : `M ${r} 0 L ${width - r} 0 A ${r} ${r} 0 0 1 ${width - r} ${height} L ${r} ${height} A ${r} ${r} 0 0 1 ${r} 0 Z`;
    return { path, outline };
};

/** Five points, touching all four sides of the box */
const star = (width: number, height: number): Geometry => {
    const rx = width / 2 / Math.sin((2 * Math.PI) / 5);
    const ry = height / (1 + Math.cos(Math.PI / 5));
    const inner = 0.45;
    return polygon(
        Array.from({ length: 10 }, (_, i): Point => {
            const angle = -Math.PI / 2 + (i * Math.PI) / 5;
            const r = i % 2 === 0 ? 1 : inner;
            return [width / 2 + Math.cos(angle) * rx * r, ry + Math.sin(angle) * ry * r];
        })
    );
};

/** Drawn on 100 × 64, then stretched to the box */
const cloud = (width: number, height: number): Geometry => {
    const p = (x: number, y: number): Point => [(x / 100) * width, (y / 64) * height];
    return curves(p(24, 62), [
        [p(9, 63), p(0, 52), p(6, 41)],
        [p(-3, 31), p(6, 16), p(21, 19)],
        [p(23, 5), p(41, -2), p(52, 9)],
        [p(60, 0), p(79, 1), p(81, 16)],
        [p(96, 14), p(104, 30), p(95, 40)],
        [p(103, 51), p(93, 65), p(78, 61)],
        [p(70, 67), p(57, 67), p(51, 61)],
        [p(44, 67), p(30, 67), p(24, 62)],
    ]);
};

const geometries: Record<DrawnShapeType, (width: number, height: number) => Geometry> = {
    pill,
    star,
    cloud,
    triangle: (w, h) =>
        polygon([
            [w / 2, 0],
            [w, h],
            [0, h],
        ]),
    hexagon: (w, h) => {
        const inset = Math.min(w * 0.25, h * 0.3);
        return polygon([
            [inset, 0],
            [w - inset, 0],
            [w, h / 2],
            [w - inset, h],
            [inset, h],
            [0, h / 2],
        ]);
    },
    parallelogram: (w, h) => {
        const slant = Math.min(w * 0.2, h * 0.5);
        return polygon([
            [slant, 0],
            [w, 0],
            [w - slant, h],
            [0, h],
        ]);
    },
    cylinder: (w, h) => {
        const rx = w / 2;
        const ry = Math.min(h * 0.14, w * 0.18);
        return {
            path: `M 0 ${ry} A ${rx} ${ry} 0 0 1 ${w} ${ry} L ${w} ${h - ry} A ${rx} ${ry} 0 0 1 0 ${h - ry} Z`,
            detail: `M 0 ${ry} A ${rx} ${ry} 0 0 0 ${w} ${ry}`,
        };
    },
    document: (w, h) => {
        const wave = Math.min(h * 0.1, 18);
        return {
            path: `M 0 0 L ${w} 0 L ${w} ${h - wave} C ${w * 0.72} ${h - wave * 3.2}, ${w * 0.36} ${h + wave * 1.4}, 0 ${h - wave} Z`,
        };
    },
    "sticky-note": (w, h) => {
        const fold = Math.min(w, h) * 0.14;
        return {
            path: toPath([
                [0, 0],
                [w, 0],
                [w, h - fold],
                [w - fold, h],
                [0, h],
            ]),
            detail: `M ${w} ${h - fold} L ${w - fold} ${h - fold} L ${w - fold} ${h}`,
        };
    },
};

type ShapeElement = {
    type: string;
    width: number;
    height: number;
    customData?: { type?: unknown };
};

const getDrawnShapeType = (element: ShapeElement) => {
    const type = element.customData?.type;
    return element.type === "rectangle" && isDrawnShapeType(type) ? type : undefined;
};

const getGeometry = (type: DrawnShapeType, width: number, height: number) =>
    geometries[type](Math.max(width, 1), Math.max(height, 1));

/** The outline and any lines inside it as one drawing, so it's drawn and exported as one */
const drawGeometry = (geometry: Geometry, generator: RoughGenerator, options: Options) => {
    const shape = generator.path(geometry.path, options);
    if (!geometry.detail) return shape;
    const detail = generator.path(geometry.detail, { ...options, fill: undefined });
    return { ...shape, sets: [...shape.sets, ...detail.sets] };
};

type ShapeHooks = {
    /** How the element is drawn, if it's one of these shapes */
    draw: (
        element: ShapeElement,
        generator: RoughGenerator,
        getOptions: (continuousPath: boolean) => Options
    ) => Drawable | undefined;
    /** Where the element is clicked, in its own coordinates, if not its box */
    outline: (element: ShapeElement) => Point[] | undefined;
    /** The image an image element is drawn with, given the one Excalidraw has for it */
    image: (element: { id: string }, image: unknown) => unknown;
};

declare global {
    // Read by the patch to @excalidraw/excalidraw (patches/), where it draws rectangles and
    // images
    var __banjoDrawShapes: ShapeHooks | undefined;
}

// The image each image element was last drawn with
const lastImages = new Map<string, HTMLImageElement>();

/**
 * An image element's new image takes a moment to load, e.g. a note's after ticking a box.
 * Meanwhile it's drawn with its last one, instead of Excalidraw's empty image.
 */
const getImage = (element: { id: string }, image: unknown) => {
    if (image instanceof HTMLImageElement) {
        lastImages.set(element.id, image);
        return image;
    }
    return lastImages.get(element.id) ?? image;
};

/** Lets Excalidraw draw the shapes. Before the first drawing, as it keeps what it has drawn. */
const register = () => {
    globalThis.__banjoDrawShapes = {
        draw: (element, generator, getOptions) => {
            const type = getDrawnShapeType(element);
            if (!type) return undefined;
            const geometry = getGeometry(type, element.width, element.height);
            return drawGeometry(geometry, generator, getOptions(true));
        },
        outline: element => {
            const type = getDrawnShapeType(element);
            if (!type) return undefined;
            return getGeometry(type, element.width, element.height).outline;
        },
        image: getImage,
    };
};

export const CustomShapeUtil = {
    register,
    drawnShapeTypes: DRAWN_SHAPE_TYPES,
    isDrawnShapeType,
    getGeometry,
    drawGeometry,
};
