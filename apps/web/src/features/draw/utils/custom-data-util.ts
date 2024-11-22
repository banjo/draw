import { includes } from "@banjoanton/utils";
import { ExcalidrawElement, ModelType } from "common";
import { ElementUtil } from "./element-util";

const isCodeBlockElement = (element: ExcalidrawElement) => {
    return element.customData?.type === "codeblock";
};

const isAnyModelElement = (element: ExcalidrawElement) => {
    if (!element.customData) return false;
    const modelElements: ModelType[] = ["model", "model-child", "model-line", "model-title"];
    return includes(modelElements, element.customData?.type);
};

const isModelContainerElement = (element: ExcalidrawElement) => {
    return element.customData?.type === "model";
};

const isModelTextElement = (element: ExcalidrawElement) => {
    return element.customData?.type === "model-child" && element.type === "text";
};

const isModelElements = (elements: ExcalidrawElement[]) => {
    const groupIds = elements.flatMap(e => e.groupIds);

    if (groupIds.length === 0) return false;

    const groupId = ElementUtil.findCommonGroupId(elements);
    if (!groupId) return false;

    const isOnlyModelElements = elements.every(isAnyModelElement);
    if (!isOnlyModelElements) return false;

    const container = elements.find(isModelContainerElement);

    return Boolean(container);
};

const isShadowElement = (element: ExcalidrawElement) => {
    return element.customData?.shadow === true;
};

export const CustomDataUtil = {
    isCodeBlockElement,
    isModelElements,
    isModelContainerElement,
    isAnyModelElement,
    isModelTextElement,
    isShadowElement,
};
