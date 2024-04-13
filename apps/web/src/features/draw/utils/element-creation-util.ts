import { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/types/data/transform";

import { convertToExcalidrawElements } from "@excalidraw/excalidraw";

import { IPoint } from "@/features/draw/models/point";
import { ExcalidrawUtil } from "@/features/draw/utils/excalidraw-util";
import { UpdateCallback, UpdateElementUtil } from "@/features/draw/utils/update-element-util";
import { DEFAULT_CODE_EDITOR_LANGUAGE } from "@/features/selected-element-visuals/models/code-editor-langauges";
import { FileId } from "@excalidraw/excalidraw/types/element/types";
import { Mutable } from "@excalidraw/excalidraw/types/utility-types";
import {
    CustomData,
    CustomElementType,
    ExcalidrawElement,
    ExcalidrawImageElement,
    ExcalidrawLinearElement,
} from "common";

const createElementFromSkeleton = (skeleton: ExcalidrawElementSkeleton): ExcalidrawElement =>
    convertToExcalidrawElements([skeleton])[0]! as ExcalidrawElement;

const createElementsFromSkeleton = (skeleton: ExcalidrawElementSkeleton[]) =>
    convertToExcalidrawElements(skeleton);

type ArrowBase = {
    x: number;
    y: number;
    points: Mutable<IPoint>[];
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
    const customData = CustomData.createCodeblock({
        code,
        shadow: false,
        language: DEFAULT_CODE_EDITOR_LANGUAGE,
    });

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

type CreateImageElementProps = {
    base: ElementBase;
    fileId: string;
    props?: Partial<ExcalidrawImageElement>;
    callback?: UpdateCallback<ExcalidrawImageElement>;
};
const createImage = ({
    base,
    fileId,
    callback,
}: CreateImageElementProps): ExcalidrawImageElement => {
    const customData = CustomData.createDefault({ shadow: false, type: "image" });

    const image: ExcalidrawElementSkeleton = {
        type: "image",
        x: base.x,
        y: base.y,
        customData,
        width: base.width,
        height: base.height,
        fileId: fileId as FileId,
    };

    const createdElement = createElementFromSkeleton(image);

    if (!ExcalidrawUtil.isImageElement(createdElement)) {
        throw new Error("Something wrong when creating image");
    }

    if (callback) {
        return UpdateElementUtil.updateElement(createdElement, callback);
    }

    return createdElement;
};

export const ElementCreationUtil = {
    createArrow,
    createElement,
    createElementFromSkeleton,
    createElementsFromSkeleton,
    createElementFromElement,
    createCodeBlock,
    createImage,
};
