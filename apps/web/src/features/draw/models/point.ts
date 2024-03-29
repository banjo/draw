import { Point as IPoint } from "@excalidraw/excalidraw/types/types";

const from = ({ x, y }: { x: number; y: number }): IPoint => [x, y];

/**
 * Excalidraw point
 */
export const Point = {
    from,
};

export type { IPoint };
