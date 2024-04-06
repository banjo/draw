import { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/types/data/transform";

import { convertToExcalidrawElements } from "@excalidraw/excalidraw";

import { IPoint } from "@/features/draw/models/point";
import { UpdateCallback, UpdateElementUtil } from "@/features/draw/utils/update-element-util";
import { Mutable } from "@excalidraw/excalidraw/types/utility-types";
import { ExcalidrawElement, ExcalidrawLinearElement, isLinearElement } from "common";

const createElementFromSkeleton = (skeleton: ExcalidrawElementSkeleton): ExcalidrawElement =>
    convertToExcalidrawElements([skeleton])[0]! as ExcalidrawElement;

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

export type ElementType = "rectangle" | "ellipse" | "diamond";
type ElementBase = {
    x: number;
    y: number;
    width: number;
    height: number;
    type: ElementType;
};
type CreateElementProps = {
    base: ElementBase;
    props?: Partial<ExcalidrawElementSkeleton>;
    callback?: UpdateCallback<ExcalidrawElement>;
};
const createElement = ({ base, props, callback }: CreateElementProps) => {
    const element: ExcalidrawElementSkeleton = {
        height: base.height,
        width: base.width,
        x: base.x,
        y: base.y,
        type: base.type as any, // just type mismatch
        ...props,
    };

    const createdElement = createElementFromSkeleton(element);

    if (callback) {
        return UpdateElementUtil.updateElement(createdElement, callback);
    }

    return createdElement;
};

type CreateElementFromElementProps = {
    type: ElementType;
    element: ExcalidrawElement;
    newValues?: Partial<ExcalidrawElement>;
};
const createElementFromElement = ({ element, newValues, type }: CreateElementFromElementProps) => {
    const newElement = {
        ...element,
        ...newValues,
        type,
    };

    return createElementFromSkeleton(newElement);
};

export const ElementCreationUtil = {
    createArrow,
    createElement,
    createElementFromSkeleton,
    createElementsFromSkeleton,
    createElementFromElement,
};
