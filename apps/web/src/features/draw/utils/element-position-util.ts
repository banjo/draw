import { ExcalidrawElements } from "@/features/draw/hooks/base/use-elements-state";
import { ArrowKey } from "@/features/draw/utils/keyboard-util";
import { Maybe } from "@banjoanton/utils";
import { getCommonBounds } from "@excalidraw/excalidraw";
import { Bounds } from "@excalidraw/excalidraw/types/element/bounds";
import { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";

const getPositionFromBounds = (bounds: Bounds) => {
    const [startX, startY, endX, endY] = bounds;

    const positions = {
        startX,
        startY,
        endX,
        endY,
    };

    return positions;
};

export type BoundsPositions = ReturnType<typeof getPositionFromBounds>;

const getPositionFromElement = (element: ExcalidrawElement) => {
    const bounds = getCommonBounds([element]);
    const positions = getPositionFromBounds(bounds);

    return {
        positions,
        width: element.width,
        height: element.height,
        id: element.id,
    };
};

export type ElementPosition = ReturnType<typeof getPositionFromElement>;

const getPositionFromElements = (elements: ExcalidrawElements) => {
    const elementPositions = elements.map(element => {
        return getPositionFromElement(element);
    });

    const groupBounds = getCommonBounds(elements);
    const groupPositions = getPositionFromBounds(groupBounds);
    const group = {
        positions: groupPositions,
        width: groupPositions.endX - groupPositions.startX, // TODO: math abs here?
        height: groupPositions.endY - groupPositions.startY, // TODO: math abs here?
    };

    return {
        elements: elementPositions,
        group,
    };
};

export type ElementsPosition = ReturnType<typeof getPositionFromElements>;

const closestElementMap: Record<
    ArrowKey,
    (closest: ElementPosition, element: ElementPosition) => boolean
> = {
    ArrowRight: (closest, element) => element.positions.endX > closest.positions.endX,
    ArrowLeft: (closest, element) => element.positions.startX > closest.positions.startX,
    ArrowDown: (closest, element) => element.positions.endY > closest.positions.endY,
    ArrowUp: (closest, element) => element.positions.startY > closest.positions.startY,
};

/**
 * Iterate over ElementPosition's to find the closest element based on a position.
 * If ArrowKey is ArrowRight, we assume the user pressed arrow right and want to find the element furthest to the right.
 */
const getClosestElement = (direction: ArrowKey, selectedElements: ExcalidrawElements) => {
    const positions = getPositionFromElements(selectedElements);

    const elementToConnectPosition = positions.elements.reduce<Maybe<ElementPosition>>(
        (acc, element) => {
            if (!acc) return element;

            const elementIsCloser = closestElementMap[direction];
            if (elementIsCloser(acc, element)) {
                return element;
            }
            return acc;
        },
        undefined
    );

    if (!elementToConnectPosition) return;

    return selectedElements.find(element => element.id === elementToConnectPosition.id);
};

export const ElementPositionUtil = {
    getPositionFromElements,
    getPositionFromElement,
    getClosestElement,
};
