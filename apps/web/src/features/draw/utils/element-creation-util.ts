import { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/types/data/transform";

import { convertToExcalidrawElements, isLinearElement } from "@excalidraw/excalidraw";

import { IPoint } from "@/features/draw/models/point";
import { UpdateCallback, UpdateElementUtil } from "@/features/draw/utils/update-element-util";
import {
    ExcalidrawElement,
    ExcalidrawLinearElement,
} from "@excalidraw/excalidraw/types/element/types";
import { Mutable } from "@excalidraw/excalidraw/types/utility-types";

const createElementFromSkeleton = (skeleton: ExcalidrawElementSkeleton) =>
    convertToExcalidrawElements([skeleton])[0]!;

const createElementsFromSkeleton = (skeleton: ExcalidrawElementSkeleton[]) =>
    convertToExcalidrawElements(skeleton);

type ArrowBase = {
    x: number;
    y: number;
    points: Mutable<IPoint>[];
    startBindingId?: string;
    endBindingId?: string;
};
const createArrow = (props: ArrowBase, callback?: UpdateCallback<ExcalidrawLinearElement>) => {
    const arrow: ExcalidrawElementSkeleton = {
        type: "arrow",
        x: props.x,
        y: props.y,
        points: props.points,
        start: props.startBindingId
            ? {
                  id: props.startBindingId,
              }
            : undefined,
        end: props.endBindingId ? { id: props.endBindingId } : undefined,
    };

    const createdElement = createElementFromSkeleton(arrow);

    if (!isLinearElement(createdElement)) {
        throw new Error("Something wrong when creating arrow");
    }

    if (callback) {
        return UpdateElementUtil.updateElement(createdElement, callback);
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
        return UpdateElementUtil.updateElement(createdElement, callback);
    }

    return createdElement;
};

export const ElementCreationUtil = {
    createArrow,
    createRectangle,
    createElementFromSkeleton,
    createElementsFromSkeleton,
};
