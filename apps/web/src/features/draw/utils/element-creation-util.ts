import { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/types/data/transform";

import { convertToExcalidrawElements } from "@excalidraw/excalidraw";

import { IPoint } from "@/features/draw/models/point";
import { ExcalidrawUtil } from "@/features/draw/utils/excalidraw-util";
import { UpdateCallback, UpdateElementUtil } from "@/features/draw/utils/update-element-util";
import { Mutable } from "@excalidraw/excalidraw/types/utility-types";
import { CustomData, CustomElementType, ExcalidrawElement, ExcalidrawLinearElement } from "common";

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
        customData: CustomData.createDefault({ shadow: false, type: "arrow" }),
    };

    const createdElement = createElementFromSkeleton(arrow);

    if (!ExcalidrawUtil.isLinearElement(createdElement)) {
        throw new Error("Something wrong when creating arrow");
    }

    if (callback) {
        return UpdateElementUtil.updateElement(createdElement, callback);
    }

    return createdElement;
};

export type ElementType = "rectangle" | "ellipse" | "diamond";
type ElementTypeAttribute = { type: ElementType };
type ElementBase = {
    x: number;
    y: number;
    width: number;
    height: number;
};
type CreateElementProps = {
    base: ElementBase & ElementTypeAttribute;
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
        customData: CustomData.createDefault({ shadow: false, type: base.type }),
        ...props,
    };

    const createdElement = createElementFromSkeleton(element);

    if (callback) {
        return UpdateElementUtil.updateElement(createdElement, callback);
    }

    return createdElement;
};

type CreateElementFromElementProps = {
    type: CustomElementType;
    element: ExcalidrawElement;
    newValues?: Partial<ExcalidrawElement>;
};
const createElementFromElement = ({ element, newValues, type }: CreateElementFromElementProps) => {
    if (type === "codeblock") {
        return createCodeBlock({
            base: {
                x: element.x,
                y: element.y,
                width: element.width,
                height: element.height,
            },
            code: "",
        });
    }

    const newElement: ExcalidrawElementSkeleton = {
        ...element,
        ...newValues,
        customData: CustomData.updateDefault(element.customData, { type }),
        type: ExcalidrawUtil.getElementTypeFromCustomType(type),
    };

    return createElementFromSkeleton(newElement);
};

type CreateCodeBlockElementProps = {
    base: ElementBase;
    code: string;
    props?: Partial<ExcalidrawElementSkeleton>;
    callback?: UpdateCallback<ExcalidrawElement>;
};
const createCodeBlock = ({ base, callback, props, code }: CreateCodeBlockElementProps) => {
    const customData = CustomData.createCodeblock({ code, shadow: false });

    // TODO: remove border and set background to a color to allow selection
    return createElement({
        base: {
            ...base,
            type: "rectangle",
        },
        props: {
            ...props,
            backgroundColor: "#ffffff",
            fillStyle: "solid",
            strokeWidth: 1,
            roughness: 0,
            roundness: null,
            strokeColor: "transparent",
            customData,
        },
        callback,
    });
};

export const ElementCreationUtil = {
    createArrow,
    createElement,
    createElementFromSkeleton,
    createElementsFromSkeleton,
    createElementFromElement,
    createCodeBlock,
};
