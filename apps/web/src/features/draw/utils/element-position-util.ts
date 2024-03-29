import { ExcalidrawElements } from "@/features/draw/hooks/base/use-elements-state";
import { ARROW_LENGTH, ELEMENT_GAP } from "@/features/draw/models/constants";
import { ElementBasicPosition, ElementMeasurement } from "@/features/draw/models/element";
import { IPoint, Point } from "@/features/draw/models/point";
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
        startX: arrow.startX + ARROW_LENGTH + ELEMENT_GAP,
        startY: arrow.startY - element.height / 2,
    }),
    ArrowLeft: (arrow, element) => ({
        startX: arrow.startX - ARROW_LENGTH - ELEMENT_GAP - element.width,
        startY: arrow.startY - element.height / 2,
    }),
    ArrowUp: (arrow, element) => ({
        startX: arrow.startX - element.width / 2,
        startY: arrow.startY - ARROW_LENGTH - ELEMENT_GAP - element.height,
    }),
    ArrowDown: (arrow, element) => ({
        startX: arrow.startX - element.width / 2,
        startY: arrow.startY + ARROW_LENGTH + ELEMENT_GAP,
    }),
};

const getAddedElementOptions = (
    direction: ArrowKey,
    arrowOptions: ArrowOptions,
    elementPosition: ElementMeasurement
) => {
    return addedElementOptionsMap[direction](arrowOptions, elementPosition);
};

export const ElementPositionUtil = {
    getPositionFromElements,
    getPositionFromElement,
    getClosestElement,
    getArrowOptionsFromSourceElement,
    getAddedElementOptions,
};
