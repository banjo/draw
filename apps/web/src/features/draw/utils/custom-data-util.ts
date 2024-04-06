import { ExcalidrawElement } from "common";

const isCodeBlockElement = (element: ExcalidrawElement) => {
    return element.customData?.type === "codeblock";
};

export const CustomDataUtil = { isCodeBlockElement };
