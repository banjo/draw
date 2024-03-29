import { ExcalidrawElements } from "@/features/draw/hooks/base/use-elements-state";
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

type Options = {
    mutate?: boolean;
};

export type UpdateCallback<T> = (element: Mutable<T>, helpers: UpdateHelpers) => T | void;

const updateElement = <T extends ExcalidrawElement>(
    element: T,
    callback: UpdateCallback<T>,
    options?: Options
) => {
    const { mutate } = defaults(options, { mutate: true });

    if (mutate) {
        return callback(element, helpers);
    }

    return produce(element, draft => {
        return callback(draft, helpers);
    });
};

const updateElements = (
    elements: ExcalidrawElements,
    callback: (element: Mutable<ExcalidrawElement>) => ExcalidrawElement
) => {
    return elements.map(element => {
        return produce(element, draft => {
            return callback(draft);
        });
    });
};

export const UpdateElementUtil = { updateElement, updateElements };
