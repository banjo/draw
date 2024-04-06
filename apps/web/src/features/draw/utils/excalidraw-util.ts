import { Maybe } from "@banjoanton/utils";
import { getCommonBounds as getCommonBoundsOriginal } from "@excalidraw/excalidraw";
import { ExcalidrawElement as ExcalidrawElementOriginal } from "@excalidraw/excalidraw/types/element/types";
import {
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

export const ExcalidrawUtil = { getCommonBounds, isLinearElement, isImageElement };
