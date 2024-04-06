import {
    ExcalidrawElement as BaseExcalidrawElement,
    ExcalidrawImageElement as BaseExcalidrawImageElement,
    ExcalidrawLinearElement as BaseExcalidrawLinearElement,
} from "@excalidraw/excalidraw/types/element/types";
import { CustomData } from "./excalidraw-element-data";

type CustomElementData = {
    customData?: CustomData;
};

export type OriginalExcalidrawElement = BaseExcalidrawElement;

type ExcalidrawElementWithoutCustomData = Omit<BaseExcalidrawElement, "customData">;
export type ExcalidrawLinearElement = Omit<BaseExcalidrawLinearElement, "customData"> &
    CustomElementData;

export type ExcalidrawImageElement2 = Omit<BaseExcalidrawImageElement, "customData"> &
    CustomElementData;

export type ExcalidrawElement = ExcalidrawElementWithoutCustomData & CustomElementData;
export type ExcalidrawElements = ExcalidrawElement[]; // before we needed this for readonly

export const isLinearElement = (element: ExcalidrawElement): element is ExcalidrawLinearElement =>
    element.type === "arrow" || element.type === "line";

export const isImageElement = (element: ExcalidrawElement): element is ExcalidrawImageElement2 =>
    element.type === "image";
