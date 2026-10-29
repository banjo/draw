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

const parentSelector = ".layer-ui__wrapper";
const createCustomNativeElement = (
    id: string,
    selector = parentSelector,
    position: "first" | "last" | number | Node = "last"
) => {
    const parent = document.querySelector(selector);
    if (!parent) return;

    // Create the custom element
    const customElement = document.createElement("div");
    customElement.id = id;
    customElement.classList.add("custom-native-element");

    // Determine where to insert the new element
    let referenceNode: Node | null = null;
    if (position === "first") {
        referenceNode = parent.firstChild;
    } else if (position === "last") {
        parent.append(customElement);
        return;
    } else if (typeof position === "number") {
        referenceNode = parent.childNodes[position] || null;
    } else if (position instanceof Node) {
        referenceNode = position;
    }

    // Insert the new element before the reference node
    if (referenceNode === null) {
        parent.append(customElement);
    } else {
        // @ts-ignore
        referenceNode.before(customElement);
    }
};

export const ExcalidrawUtil = {
    getCommonBounds,
    isLinearElement,
    isImageElement,
    isTextElement,
    getElementTypeFromCustomType,
    createCustomNativeElement,
};
