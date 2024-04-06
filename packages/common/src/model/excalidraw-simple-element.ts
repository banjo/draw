import { z } from "zod";
import { ExcalidrawElement } from "./excalidraw-element";

export const ExcalidrawSimpleElementSchema = z
    .object({
        id: z.number().or(z.string()),
        version: z.number(),
        isDeleted: z.boolean(),
    })
    .passthrough();

export type ExcalidrawSimpleElement = z.infer<typeof ExcalidrawSimpleElementSchema>;

const from = (object: unknown): ExcalidrawSimpleElement =>
    ExcalidrawSimpleElementSchema.parse(object);

const fromMany = (objects: unknown[] | readonly unknown[]): ExcalidrawSimpleElement[] =>
    objects.map(from);

const toExcalidrawElement = (element: ExcalidrawSimpleElement): ExcalidrawElement =>
    element as ExcalidrawElement;

const toExcalidrawElements = (elements: ExcalidrawSimpleElement[]): ExcalidrawElement[] =>
    elements.map(toExcalidrawElement);

export const ExcalidrawSimpleElement = {
    from,
    fromMany,
    toExcalidrawElement,
    toExcalidrawElements,
};
