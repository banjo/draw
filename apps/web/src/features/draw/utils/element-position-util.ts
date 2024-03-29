import { ExcalidrawElements } from "@/features/draw/hooks/base/use-elements-state";
import { getCommonBounds } from "@excalidraw/excalidraw";
import { Bounds } from "@excalidraw/excalidraw/types/element/bounds";
import { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";

const getPositionFromBounds = (bounds: Bounds) => {
    const [startX, startY, endX, endY] = bounds;

    const middle = {
        x: startX + (endX - startX) / 2,
        y: startY + (endY - startY) / 2,
    };

    const middleRight = {
        x: endX,
        y: middle.y,
    };

    const middleLeft = {
        x: startX,
        y: middle.y,
    };

    const middleTop = {
        x: middle.x,
        y: startY,
    };

    const middleBottom = {
        x: middle.x,
        y: endY,
    };

    const topLeft = {
        x: startX,
        y: startY,
    };

    const topRight = {
        x: endX,
        y: startY,
    };

    const bottomLeft = {
        x: startX,
        y: endY,
    };

    const bottomRight = {
        x: endX,
        y: endY,
    };

    const positions = {
        middle,
        middleRight,
        middleLeft,
        middleTop,
        middleBottom,
        topLeft,
        topRight,
        bottomLeft,
        bottomRight,
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
        width: groupPositions.middleRight.x - groupPositions.middleLeft.x,
        height: groupPositions.middleBottom.y - groupPositions.middleTop.y,
    };

    return {
        elements: elementPositions,
        group,
    };
};

export type ElementsPosition = ReturnType<typeof getPositionFromElements>;

export const ElementPositionUtil = { getPositionFromElements, getPositionFromElement };
