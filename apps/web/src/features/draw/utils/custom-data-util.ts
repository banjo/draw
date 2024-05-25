import { uniq } from "@banjoanton/utils";
import { ExcalidrawElement } from "common";

const isCodeBlockElement = (element: ExcalidrawElement) => {
    return element.customData?.type === "codeblock";
};

const isModelElement = (element: ExcalidrawElement) => {
    return element.customData?.type === "model";
};

const isModelElements = (elements: ExcalidrawElement[]) => {
    const groupIds = elements.flatMap(e => e.groupIds);

    if (groupIds.length === 0) return false;
    if (uniq(groupIds).length > 1) return false;

    const container = elements.find(isModelElement);

    return Boolean(container);
};

export const CustomDataUtil = { isCodeBlockElement, isModelElements, isModelElement };
