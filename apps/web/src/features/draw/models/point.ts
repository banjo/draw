import { ExcalidrawLinearElement } from "@excalidraw/excalidraw/element/types";

/** A point relative to its linear element */
export type IPoint = ExcalidrawLinearElement["points"][number];

const from = ({ x, y }: { x: number; y: number }) => [x, y] as IPoint;

/**
 * Excalidraw point
 */
export const Point = {
    from,
};
