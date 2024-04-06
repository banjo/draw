import { ArrowKey } from "@/features/draw/hooks/base/use-keyboard";
import { ARROW_LENGTH, ELEMENT_GAP } from "@/features/draw/models/constants";

import { IPoint, Point } from "@/features/draw/models/point";
import { Maybe } from "@banjoanton/utils";
import { getCommonBounds } from "@excalidraw/excalidraw";
import { Bounds } from "@excalidraw/excalidraw/types/element/bounds";
import { AppState } from "@excalidraw/excalidraw/types/types";
import {
    ElementBasicPosition,
    ElementMeasurement,
    ExcalidrawElement,
    ExcalidrawElements,
} from "common";

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
    ArrowLeft: (closest, element) => element.positions.startX < closest.positions.startX,
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

export type ArrowOptions = {
    startX: number;
    startY: number;
    relativeEndPoint: IPoint;
};

type GetArrowOptionsCallback = (element: ExcalidrawElement) => ArrowOptions;

const arrowMap: Record<ArrowKey, GetArrowOptionsCallback> = {
    ArrowRight: element => ({
        startX: element.x + element.width + ELEMENT_GAP,
        startY: element.y + element.height / 2,
        relativeEndPoint: Point.from({ x: ARROW_LENGTH, y: 0 }),
    }),
    ArrowLeft: element => ({
        startX: element.x - ELEMENT_GAP,
        startY: element.y + element.height / 2,
        relativeEndPoint: Point.from({ x: -ARROW_LENGTH, y: 0 }),
    }),
    ArrowUp: element => ({
        startX: element.x + element.width / 2,
        startY: element.y - ELEMENT_GAP,
        relativeEndPoint: Point.from({ x: 0, y: -ARROW_LENGTH }),
    }),
    ArrowDown: element => ({
        startX: element.x + element.width / 2,
        startY: element.y + element.height + ELEMENT_GAP,
        relativeEndPoint: Point.from({ x: 0, y: ARROW_LENGTH }),
    }),
};

const getArrowOptionsFromSourceElement = (direction: ArrowKey, element: ExcalidrawElement) => {
    return arrowMap[direction](element);
};

type AddedElementOptionsCallback = (
    arrowOptions: ArrowOptions,
    measurements: ElementMeasurement
) => ElementBasicPosition;

const addedElementOptionsMap: Record<ArrowKey, AddedElementOptionsCallback> = {
    ArrowRight: (arrow, element) => ({
        x: arrow.startX + ARROW_LENGTH + ELEMENT_GAP,
        y: arrow.startY - element.height / 2,
    }),
    ArrowLeft: (arrow, element) => ({
        x: arrow.startX - ARROW_LENGTH - ELEMENT_GAP - element.width,
        y: arrow.startY - element.height / 2,
    }),
    ArrowUp: (arrow, element) => ({
        x: arrow.startX - element.width / 2,
        y: arrow.startY - ARROW_LENGTH - ELEMENT_GAP - element.height,
    }),
    ArrowDown: (arrow, element) => ({
        x: arrow.startX - element.width / 2,
        y: arrow.startY + ARROW_LENGTH + ELEMENT_GAP,
    }),
};

const getAddedElementOptions = (
    direction: ArrowKey,
    arrowOptions: ArrowOptions,
    elementPosition: ElementMeasurement
) => {
    return addedElementOptionsMap[direction](arrowOptions, elementPosition);
};

type ReverseStepHandler = (position: ElementBasicPosition, step?: number) => ElementBasicPosition;
type ReverseStepMap = Record<ArrowKey, ReverseStepHandler>;

const DEFAULT_STEP = 1;
const reverseStepMap: ReverseStepMap = {
    ArrowRight: ({ x, y }, step = DEFAULT_STEP) => ({ x: x - step, y }),
    ArrowLeft: ({ x, y }, step = DEFAULT_STEP) => ({ x: x + step, y }),
    ArrowUp: ({ x, y }, step = DEFAULT_STEP) => ({ x, y: y + step }),
    ArrowDown: ({ x, y }, step = DEFAULT_STEP) => ({ x, y: y - step }),
};

const reverseStep = (direction: ArrowKey, position: ElementBasicPosition, step?: number) => {
    return reverseStepMap[direction](position, step);
};

/**
 * Get position in the Window scope from an element.
 */
const getElementWindowPosition = (element: ExcalidrawElement, state: AppState) => {
    const position = ElementPositionUtil.getPositionFromElement(element);

    // Canvas position of the element
    const x = position.positions.startX;
    const y = position.positions.startY;

    const { scrollX, scrollY, zoom } = state;

    // Adjust the position to the window and the zoom
    const adjustedX = (x + scrollX) * zoom.value;
    const adjustedY = (y + scrollY) * zoom.value;

    return {
        x: adjustedX,
        y: adjustedY,
    };
};

export const ElementPositionUtil = {
    getPositionFromElements,
    getPositionFromElement,
    getClosestElement,
    getArrowOptionsFromSourceElement,
    getAddedElementOptions,
    reverseStep,
    getElementWindowPosition,
};
