import { ElementType } from "@/features/draw/utils/element-creation-util";
import { Maybe } from "@banjoanton/utils";
import { getCommonBounds as getCommonBoundsOriginal } from "@excalidraw/excalidraw";
import { ExcalidrawElement as ExcalidrawElementOriginal } from "@excalidraw/excalidraw/element/types";
import {
    CustomElementType,
    ExcalidrawElement,
    ExcalidrawElements,
    ExcalidrawImageElement,
    ExcalidrawLinearElement,
    ExcalidrawTextElement,
} from "common";

const getCommonBounds = (elements: ExcalidrawElements) =>
    getCommonBoundsOriginal(elements as readonly ExcalidrawElementOriginal[]);

const isLinearElement = (element: Maybe<ExcalidrawElement>): element is ExcalidrawLinearElement =>
    element?.type === "arrow" || element?.type === "line";

const isImageElement = (element: Maybe<ExcalidrawElement>): element is ExcalidrawImageElement =>
    element?.type === "image";

const isTextElement = (element: Maybe<ExcalidrawElement>): element is ExcalidrawTextElement =>
    element?.type === "text";

const elementToCustomElementType: Record<CustomElementType, ElementType> = {
    arrow: "rectangle", // wont happen
    image: "rectangle", // wont happen
    text: "rectangle", // wont happen
    line: "rectangle", // wont happen
    "model-child": "rectangle", // wont happen
    "model-line": "rectangle", // wont happen
    "model-title": "rectangle", // wont happen
    model: "rectangle",
    codeblock: "rectangle", // wont happen, code blocks are images
    mermaid: "rectangle", // wont happen, Mermaid blocks are images
    swimlane: "rectangle", // wont happen, swimlanes are frames
    "swimlane-part": "rectangle", // wont happen
    markdown: "rectangle", // wont happen, notes are images
    table: "rectangle", // wont happen, tables are images
    link: "rectangle", // wont happen, link cards are images
    chart: "rectangle", // wont happen, charts are images
    diamond: "diamond",
    ellipse: "ellipse",
    rectangle: "rectangle",
    circle: "ellipse",
    // Drawn as other shapes by CustomShapeUtil
    pill: "rectangle",
    triangle: "rectangle",
    hexagon: "rectangle",
    star: "rectangle",
    parallelogram: "rectangle",
    cylinder: "rectangle",
    document: "rectangle",
    cloud: "rectangle",
    "sticky-note": "rectangle",
};

const getElementTypeFromCustomType = (type: CustomElementType): ElementType =>
    elementToCustomElementType[type];

export const ExcalidrawUtil = {
    getCommonBounds,
    isLinearElement,
    isImageElement,
    isTextElement,
    getElementTypeFromCustomType,
};
