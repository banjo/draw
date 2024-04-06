import {
    ExcalidrawElement as BaseExcalidrawElement,
    ExcalidrawLinearElement as BaseExcalidrawLinearElement,
} from "@excalidraw/excalidraw/types/element/types";
import { CustomData } from "./excalidraw-element-data";

export type ElementBasicPosition = {
    x: number;
    y: number;
};

export const ElementBasicPosition = {
    from: (options: ElementBasicPosition) => options,
};

export type ElementMeasurement = {
    width: number;
    height: number;
};

export const ElementMeasurement = {
    from: (measurement: ElementMeasurement) => measurement,
};

type CustomElementData = {
    customData?: CustomData;
};

export type OriginalExcalidrawElement = BaseExcalidrawElement;

type ExcalidrawElementWithoutCustomData = Omit<BaseExcalidrawElement, "customData">;
export type ExcalidrawLinearElement = Omit<BaseExcalidrawLinearElement, "customData"> &
    CustomElementData;
export type ExcalidrawElement = ExcalidrawElementWithoutCustomData & CustomElementData;
export type ExcalidrawElements = ExcalidrawElement[]; // before we needed this for readonly

export const isLinearElement = (element: ExcalidrawElement): element is ExcalidrawLinearElement =>
    element.type === "arrow" || element.type === "line";
