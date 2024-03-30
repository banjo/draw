import { ELEMENT_GAP } from "@/features/draw/models/constants";
import { defaults, produce } from "@banjoanton/utils";
import {
    ExcalidrawElement,
    ExcalidrawLinearElement,
} from "@excalidraw/excalidraw/types/element/types";
import { Mutable } from "@excalidraw/excalidraw/types/utility-types";

type BoundElement = {
    id: string;
    type: "arrow";
};

const addBoundElements = (element: Mutable<ExcalidrawElement>, boundElements: BoundElement[]) => {
    if (!element.boundElements) {
        element.boundElements = boundElements;
    } else {
        boundElements.forEach(boundElement => {
            if (!element.boundElements) return;
            // @ts-ignore
            element.boundElements.push(boundElement);
        });
    }
};

const defaultSettings = (element: Mutable<ExcalidrawElement>) => {
    element.roughness = 1;
    element.strokeWidth = 2;
    element.roundness = { type: 3 };
    element.fillStyle = "solid";
    element.opacity = 100;
};

type BindingOptions = {
    startId?: string;
    endId?: string;
    gap?: number;
};
const addArrowBindings = (element: Mutable<ExcalidrawLinearElement>, options?: BindingOptions) => {
    const { gap, endId, startId } = defaults(options, { gap: ELEMENT_GAP });
    if (startId) {
        element.startBinding = {
            elementId: startId,
            focus: 0.2,
            gap: gap,
        };
    }

    if (endId) {
        element.endBinding = {
            elementId: endId,
            focus: 0.2,
            gap: gap,
        };
    }
};

const helpers = {
    addBoundElements,
    defaultSettings,
    addArrowBindings,
};

type UpdateHelpers = typeof helpers;

export type UpdateCallback<T> = (element: Mutable<T>, helpers: UpdateHelpers) => T;

/**
 * Update an element with a callback, returning a new element with same ID.
 * @param element - The element to update
 * @param callback - The callback to update the element
 */
const updateElement = <T extends ExcalidrawElement>(element: T, callback: UpdateCallback<T>) => {
    return produce(element, draft => {
        return callback(draft, helpers);
    });
};

/**
 * Update an array of elements with a callback, returning a new array new elements with same IDs.
 * @param elements - The elements to update
 * @param callback - The callback to update the elements
 */
const updateElements = <T extends ExcalidrawElement>(
    elements: T[] | readonly T[],
    callback: UpdateCallback<T>
) => {
    return elements.map(element => {
        return produce(element, draft => {
            return callback(draft, helpers);
        });
    });
};

export type MutateCallback<T> = (element: Mutable<T>, helpers: UpdateHelpers) => void;

/**
 * Mutate an element with a callback.
 * @param element - The element to update
 * @param callback - The callback to update the element
 */
const mutateElement = <T extends ExcalidrawElement>(element: T, callback: MutateCallback<T>) => {
    callback(element, helpers);
};

/**
 * Mutate an array of elements with a callback.
 * @param elements - The elements to update
 * @param callback - The callback to update the elements
 */
const mutateElements = <T extends ExcalidrawElement>(
    elements: T[] | readonly T[],
    callback: MutateCallback<T>
) => {
    elements.map(element => {
        callback(element, helpers);
    });
};

export const UpdateElementUtil = { updateElement, updateElements, mutateElements, mutateElement };
