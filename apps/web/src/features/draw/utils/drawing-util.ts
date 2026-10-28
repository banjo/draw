import { ElementMeasurement } from "common";

const focusCanvas = () => {
    const element = document.querySelector<HTMLDivElement>(".excalidraw");
    if (element) {
        element.focus();
    }
};

const isElementTooSmall = (element: ElementMeasurement, zoomLevel: number, min: number) => {
    const adjustedWidth = element.width * zoomLevel;
    const adjustedHeight = element.height * zoomLevel;

    return adjustedWidth < min || adjustedHeight < min;
};

export const DrawingUtil = {
    focusCanvas,
    isElementTooSmall,
};
