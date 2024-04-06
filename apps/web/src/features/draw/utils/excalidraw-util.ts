import { ElementType } from "@/features/draw/utils/element-creation-util";
import { Maybe } from "@banjoanton/utils";
import { getCommonBounds as getCommonBoundsOriginal } from "@excalidraw/excalidraw";
import { ExcalidrawElement as ExcalidrawElementOriginal } from "@excalidraw/excalidraw/types/element/types";
import {
    CustomElementType,
    ExcalidrawElement,
    ExcalidrawElements,
    ExcalidrawImageElement,
    ExcalidrawLinearElement,
} from "common";

const getCommonBounds = (elements: ExcalidrawElements) => {
    return getCommonBoundsOriginal(elements as readonly ExcalidrawElementOriginal[]);
};

const isLinearElement = (element: Maybe<ExcalidrawElement>): element is ExcalidrawLinearElement =>
    element?.type === "arrow" || element?.type === "line";

const isImageElement = (element: Maybe<ExcalidrawElement>): element is ExcalidrawImageElement =>
    element?.type === "image";

const elementToCustomElementType: Record<CustomElementType, ElementType> = {
    arrow: "rectangle", // wont happen
    codeblock: "rectangle",
    diamond: "diamond",
    ellipse: "ellipse",
    rectangle: "rectangle",
};

const getElementTypeFromCustomType = (type: CustomElementType): ElementType => {
    return elementToCustomElementType[type];
};

export const ExcalidrawUtil = {
    getCommonBounds,
    isLinearElement,
    isImageElement,
    getElementTypeFromCustomType,
};
