import {
    ExcalidrawElement as BaseExcalidrawElement,
    ExcalidrawImageElement as BaseExcalidrawImageElement,
    ExcalidrawLinearElement as BaseExcalidrawLinearElement,
    ExcalidrawTextElement as BaseExcalidrawTextElement,
} from "@excalidraw/excalidraw/types/element/types";
import { CustomData } from "./excalidraw-custom-data";

type CustomElementData = {
    customData?: CustomData;
};

export type OriginalExcalidrawElement = BaseExcalidrawElement;

type ExcalidrawElementWithoutCustomData = Omit<BaseExcalidrawElement, "customData">;
export type ExcalidrawLinearElement = Omit<BaseExcalidrawLinearElement, "customData"> &
    CustomElementData;

export type ExcalidrawImageElement = Omit<BaseExcalidrawImageElement, "customData"> &
    CustomElementData;

export type ExcalidrawTextElement = Omit<BaseExcalidrawTextElement, "customData"> &
    CustomElementData;

export type ExcalidrawElement = ExcalidrawElementWithoutCustomData & CustomElementData;
export type ExcalidrawElements = ExcalidrawElement[]; // before we needed this for readonly
