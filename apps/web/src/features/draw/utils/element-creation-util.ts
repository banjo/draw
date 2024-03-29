import { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/types/data/transform";

import { convertToExcalidrawElements, isLinearElement } from "@excalidraw/excalidraw";

import { UpdateCallback, UpdateElementUtil } from "@/features/draw/utils/update-element-util";
import {
    ExcalidrawElement,
    ExcalidrawLinearElement,
} from "@excalidraw/excalidraw/types/element/types";

const createElementFromSkeleton = (skeleton: ExcalidrawElementSkeleton) =>
    convertToExcalidrawElements([skeleton])[0]!;

const createElementsFromSkeleton = (skeleton: ExcalidrawElementSkeleton[]) =>
    convertToExcalidrawElements(skeleton);

type Point = [x: number, y: number];
type ArrowBase = {
    x: number;
    y: number;
    points: Point[];
};
const createArrow = (props: ArrowBase, callback?: UpdateCallback<ExcalidrawLinearElement>) => {
    const arrow: ExcalidrawElementSkeleton = {
        type: "arrow",
        x: props.x,
        y: props.y,
        points: props.points,
    };

    const createdElement = createElementFromSkeleton(arrow);

    if (!isLinearElement(createdElement)) {
        throw new Error("Something wrong when creating arrow");
    }

    if (callback) {
        UpdateElementUtil.updateElement(createdElement, callback);
    }

    return createdElement;
};

type RectangleBase = {
    x: number;
    y: number;
    width: number;
    height: number;
};
const createRectangle = (props: RectangleBase, callback?: UpdateCallback<ExcalidrawElement>) => {
    const rectangle: ExcalidrawElementSkeleton = {
        type: "rectangle",
        x: props.x,
        y: props.y,
        width: props.width,
        height: props.height,
    };

    const createdElement = createElementFromSkeleton(rectangle);

    if (callback) {
        UpdateElementUtil.updateElement(createdElement, callback);
    }

    return createdElement;
};

export const ElementCreationUtil = {
    createArrow,
    createRectangle,
    createElementFromSkeleton,
    createElementsFromSkeleton,
};
