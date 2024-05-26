import { uniq } from "@banjoanton/utils";
import { ExcalidrawElement } from "common";

const isCodeBlockElement = (element: ExcalidrawElement) => {
    return element.customData?.type === "codeblock";
};

const isAnyModelElement = (element: ExcalidrawElement) => {
    return element.customData?.type === "model" || element.customData?.type === "model-child";
};

const isModelContainerElement = (element: ExcalidrawElement) => {
    return element.customData?.type === "model";
};

const isModelElements = (elements: ExcalidrawElement[]) => {
    const groupIds = elements.flatMap(e => e.groupIds);

    if (groupIds.length === 0) return false;
    if (uniq(groupIds).length > 1) return false;

    const isOnlyModelElements = elements.every(isAnyModelElement);

    if (!isOnlyModelElements) return false;

    const container = elements.find(isModelContainerElement);

    return Boolean(container);
};

export const CustomDataUtil = {
    isCodeBlockElement,
    isModelElements,
    isModelContainerElement,
    isAnyModelElement,
};
