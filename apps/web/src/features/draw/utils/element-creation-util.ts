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
import { ElementUtil } from "./element-util";
import { first, toArray } from "@banjoanton/utils";
import { CustomDataUtil } from "./custom-data-util";
import toast from "react-hot-toast";

const createElementFromSkeleton = (skeleton: ExcalidrawElementSkeleton): ExcalidrawElement =>
    convertToExcalidrawElements([skeleton])[0]! as ExcalidrawElement;

const createElementsFromSkeleton = (skeleton: ExcalidrawElementSkeleton[]) =>
    convertToExcalidrawElements(skeleton);

type LinearElementBase = {
    x: number;
    y: number;
    points: Mutable<IPoint>[];
    type: "line" | "arrow";
};
const createLinearElement = (
    props: LinearElementBase,
    callback?: UpdateCallback<ExcalidrawLinearElement>,
    customElementType?: CustomElementType
) => {
    const arrow: ExcalidrawElementSkeleton = {
        type: props.type,
        x: props.x,
        y: props.y,
        points: props.points,
        customData: CustomData.createDefault({
            shadow: false,
            type: customElementType ?? props.type,
        }),
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
type BasePosition = { x: number; y: number };
type BaseSize = { width: number; height: number };
type ElementBase = BaseSize & BasePosition;

type CreateElementProps = {
    base: ElementBase & ElementTypeAttribute;
    props?: Partial<ExcalidrawElementSkeleton>;
    customElementType?: CustomElementType;
    callback?: UpdateCallback<ExcalidrawElement>;
};
const createElement = ({ base, props, callback, customElementType }: CreateElementProps) => {
    const element: ExcalidrawElementSkeleton = {
        height: base.height,
        width: base.width,
        x: base.x,
        y: base.y,
        type: base.type as any, // just type mismatch
        customData: CustomData.createDefault({
            shadow: false,
            type: customElementType ?? base.type,
        }),
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
const createElementsFromElement = ({ element, newValues, type }: CreateElementFromElementProps) => {
    if (type === "codeblock") {
        return toArray(
            createCodeBlock({
                base: {
                    x: element.x,
                    y: element.y,
                    width: element.width,
                    height: element.height,
                },
                code: "",
            })
        );
    }

    if (type === "model") {
        return createModelElement({ base: { x: element.x, y: element.y } });
    }

    const newElement: ExcalidrawElementSkeleton = {
        ...element,
        ...newValues,
        customData: CustomData.updateDefault(element.customData, { type }),
        type: ExcalidrawUtil.getElementTypeFromCustomType(type),
    };

    return toArray(createElementFromSkeleton(newElement));
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

const createText = (
    text: string,
    base: ElementBase & { fontSize?: number },
    callback?: UpdateCallback<ExcalidrawElement>,
    customElementType?: CustomElementType
) => {
    const element = first(
        convertToExcalidrawElements([
            {
                type: "text",
                x: base.x,
                y: base.y,
                width: base.width,
                height: base.height,
                text: text,
                fontSize: base.fontSize ?? 20,
                customData: CustomData.createDefault({
                    type: customElementType ?? "text",
                    shadow: false,
                }),
            },
        ])
    );

    if (!element) {
        throw new Error("Something wrong when creating text");
    }

    if (callback) {
        return UpdateElementUtil.updateElement(element as ExcalidrawElement, callback);
    }

    return element as ExcalidrawElement;
};

const TEXT_HEIGHT = 25;
const ELEMENT_WIDTH = 256;
const SPACING = 10;

type CreateModelElement = {
    base: BasePosition;
    props?: Partial<ExcalidrawElementSkeleton>;
    callback?: UpdateCallback<ExcalidrawElementSkeleton>;
};

const createModelElement = ({ base }: CreateModelElement): ExcalidrawElement[] => {
    // A model element consists of:
    // - a rectangle as a container
    // - A text title at the top of the container
    // - A devider line
    // - An example text line
    // - Another example text line

    // they should all have the same groupId
    // Only the rectangle should have a customData of type "model"

    const customData = CustomData.createModel({
        shadow: false,
        currentHeight: 0,
        textElementCount: 0,
    });
    const title = "User";
    const exampleText = "name";
    const exampleText2 = "age";

    const groupId = ElementUtil.createElementId();

    let currentY = base.y;

    const container = createElement({
        base: {
            type: "rectangle",
            y: currentY,
            x: base.x,
            height: 0, // will be updated later
            width: ELEMENT_WIDTH,
        },
        props: {
            customData,
            backgroundColor: "#ffc9c9",
        },
        callback: element => {
            element.groupIds = [groupId];
            return element;
        },
    });

    currentY += SPACING;

    const titleElement = createText(
        title,
        {
            x: base.x + SPACING,
            y: currentY,
            width: ELEMENT_WIDTH,
            height: 35, // large title size
            fontSize: 28,
        },
        element => {
            element.groupIds = [groupId];
            return element;
        }
    );

    currentY += SPACING + TEXT_HEIGHT + SPACING;

    const divider = createLinearElement(
        {
            type: "line",
            x: base.x,
            y: currentY,
            points: [
                [0, 0],
                [ELEMENT_WIDTH, 0],
            ],
        },
        element => {
            element.groupIds = [groupId];
            return element;
        }
    );

    currentY += SPACING;

    const exampleTextElement = createText(
        exampleText,
        {
            x: base.x + SPACING,
            y: currentY,
            width: ELEMENT_WIDTH,
            height: TEXT_HEIGHT,
        },
        element => {
            element.groupIds = [groupId];
            return element;
        }
    );

    currentY += TEXT_HEIGHT + SPACING;

    const exampleTextElement2 = createText(
        exampleText2,
        {
            x: base.x + SPACING,
            y: currentY,
            width: ELEMENT_WIDTH,
            height: TEXT_HEIGHT,
        },
        element => {
            element.groupIds = [groupId];
            return element;
        }
    );

    currentY += TEXT_HEIGHT + SPACING;
    const totalHeight = currentY - base.y;

    UpdateElementUtil.mutateElement(container, element => {
        element.height = totalHeight;
        element.customData = CustomData.updateModel(element.customData, {
            currentHeight: totalHeight,
            textElementCount: 2,
        });
    });

    return [container, titleElement, divider, exampleTextElement, exampleTextElement2];
};

const appendTextToModelElement = (modelElements: ExcalidrawElement[], text: string) => {
    if (!CustomDataUtil.isModelElements(modelElements)) {
        toast.error("Cannot append text to non-model elements");
        return;
    }

    const container = modelElements.find(CustomDataUtil.isModelElement);

    if (!container) {
        toast.error("Cannot find container element");
        return;
    }

    const customData = CustomData.parseModelData(container.customData);

    if (!customData) {
        toast.error("Cannot parse custom data");
        return;
    }

    const groupId = container.groupIds[0];

    if (!groupId) {
        toast.error("Cannot find groupId");
        return;
    }

    const currentY = container.y + customData.currentHeight;

    const textElement = createText(
        text,
        {
            x: container.x + SPACING,
            y: currentY,
            width: ELEMENT_WIDTH,
            height: TEXT_HEIGHT,
        },
        element => {
            element.groupIds = [groupId];
            return element;
        }
    );

    const updatedContainer = UpdateElementUtil.updateElement(container, element => {
        element.height += TEXT_HEIGHT + SPACING;
        element.customData = CustomData.updateModel(element.customData, {
            currentHeight: element.height,
            textElementCount: customData.textElementCount + 1,
        });
        return element;
    });

    const finalElements = ElementUtil.mergeElements(modelElements, [updatedContainer, textElement]);

    return finalElements;
};

export const ElementCreationUtil = {
    createLinearElement,
    createElement,
    createElementFromSkeleton,
    createElementsFromSkeleton,
    createElementsFromElement,
    createCodeBlock,
    createImage,
    createModelElement,
    createText,
    appendTextToModelElement,
};
