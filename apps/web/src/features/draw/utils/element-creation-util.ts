import { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/types/data/transform";

import { convertToExcalidrawElements } from "@excalidraw/excalidraw";

import {
    ExcalidrawArrowElement,
    ExcalidrawRectangleElement,
} from "@excalidraw/excalidraw/types/element/types";

const createElementFromSkeleton = (skeleton: ExcalidrawElementSkeleton) =>
    convertToExcalidrawElements([skeleton])[0]!;

const createElementsFromSkeleton = (skeleton: ExcalidrawElementSkeleton[]) =>
    convertToExcalidrawElements(skeleton);

const createArrow = (props: Partial<ExcalidrawArrowElement>) => {
    const arrow: ExcalidrawElementSkeleton = {
        type: "arrow",
        x: props.x ?? 0,
        y: props.y ?? 0,
        startBinding: props.startBinding ?? null,
        endBinding: props.endBinding ?? null,
        points: props.points ?? [],
    };

    return createElementFromSkeleton(arrow);
};

const createRectangle = (props: Partial<ExcalidrawRectangleElement>) => {
    const rectangle: ExcalidrawElementSkeleton = {
        type: "rectangle",
        x: props.x ?? 0,
        y: props.y ?? 0,
        width: props.width ?? 100,
        height: props.height ?? 100,
        fillStyle: props.fillStyle ?? "hachure",
        strokeWidth: props.strokeWidth ?? 1,
        strokeStyle: props.strokeStyle ?? "solid",
        roughness: props.roughness ?? 1,
        opacity: props.opacity ?? 100,
        angle: props.angle ?? 0,
    };

    return createElementFromSkeleton(rectangle);
};

export const ElementCreationUtil = {
    createArrow,
    createRectangle,
    createElementFromSkeleton,
    createElementsFromSkeleton,
};
