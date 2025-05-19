import { ElementCreationUtil } from "@/features/draw/utils/element-creation-util";
import { FileUtil } from "@/features/draw/utils/file-util";
import { raise } from "@banjoanton/utils";
import { BinaryFileData } from "@excalidraw/excalidraw/types/types";
import { ExcalidrawElement } from "common";
import html2canvas from "html2canvas";

export type CustomElementImageData = {
    data: string;
    mimeType: string;
    element: ExcalidrawElement;
    binaryFileData: BinaryFileData;
    htmlElement: HTMLElement;
};

const fromHtmlElement = async (
    htmlElement: HTMLElement,
    customExcalidrawElements: ExcalidrawElement[]
): Promise<CustomElementImageData> => {
    const canvas = await html2canvas(htmlElement, {
        allowTaint: true,
        logging: false,
        backgroundColor: null,
        scale: 3,
    });

    const mimeType = "image/png";
    const data = canvas.toDataURL(mimeType, 1);
    const elementId = htmlElement.dataset.elementId ?? raise("Element id not found");
    const element =
        customExcalidrawElements.find(e => e.id === elementId) ?? raise("Element not found");

    const binaryFileData = FileUtil.createImageFile({ data, mimeType });
    return { data, element, mimeType, binaryFileData, htmlElement };
};

const toExcalidrawImageElement = ({ element, binaryFileData }: CustomElementImageData) =>
    ElementCreationUtil.createImage({
        base: {
            height: element.height,
            width: element.width,
            x: element.x,
            y: element.y,
        },
        fileId: binaryFileData.id,
    });

export const CustomElementImageData = { fromHtmlElement, toExcalidrawImageElement };
