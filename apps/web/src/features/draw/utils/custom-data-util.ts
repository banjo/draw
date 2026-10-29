import { includes } from "@banjoanton/utils";
import { ExcalidrawElement, ModelType } from "common";
import { ElementUtil } from "./element-util";

const isCodeBlockElement = (element: ExcalidrawElement) => element.customData?.type === "codeblock";

const isMermaidElement = (element: ExcalidrawElement) =>
    element.type === "image" && element.customData?.type === "mermaid";

const isMarkdownNote = (element: ExcalidrawElement) =>
    element.type === "image" && element.customData?.type === "markdown";

const isAnyModelElement = (element: ExcalidrawElement) => {
    if (!element.customData) return false;
    const modelElements: ModelType[] = ["model", "model-child", "model-line", "model-title"];
    return includes(modelElements, element.customData?.type);
};

const isModelContainerElement = (element: ExcalidrawElement) =>
    element.customData?.type === "model";

const isModelTextElement = (element: ExcalidrawElement) =>
    element.customData?.type === "model-child" && element.type === "text";

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

/**
 * Whether Tab, ⌘/Ctrl+arrow and the extend buttons work on it: not on frames, like a
 * swimlane, or the parts a swimlane is drawn with
 */
const hasShapeActions = (element: ExcalidrawElement) =>
    element.type !== "frame" &&
    element.type !== "magicframe" &&
    element.customData?.type !== "swimlane-part";

const isShadowElement = (element: ExcalidrawElement) => element.customData?.shadow === true;

export const CustomDataUtil = {
    isCodeBlockElement,
    isMermaidElement,
    isMarkdownNote,
    isModelElements,
    isModelContainerElement,
    isAnyModelElement,
    isModelTextElement,
    isShadowElement,
    hasShapeActions,
};
