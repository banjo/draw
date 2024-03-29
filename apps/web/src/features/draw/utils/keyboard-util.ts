import { ElementCreationUtil } from "@/features/draw/utils/element-creation-util";
import { ElementPosition, ElementPositionUtil } from "@/features/draw/utils/element-position-util";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { Maybe, clone } from "@banjoanton/utils";
import { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import { ElementStateUtil } from "common";

export type KeyboardEvent = React.KeyboardEvent<HTMLDivElement>;

const handleMetaEnter = (event: KeyboardEvent, excalidrawApi: ExcalidrawImperativeAPI) => {
    const elements = excalidrawApi.getSceneElements();
    const state = excalidrawApi.getAppState();

    const selectedIds = ElementStateUtil.getSelectedElementIds(state);
    const selectedElements = elements.filter(element => selectedIds.includes(element.id));

    const copiedElements = selectedElements.map(element => {
        const cloned = clone(element);
        return ElementUtil.resetElement(cloned);
    });

    // TODO: maybe not element group by default? Or maybe do?
    const { updatedElements, updatedState } = ElementUtil.createNewElementGroup(
        copiedElements,
        state
    );

    const movedElements = ElementUtil.updateElements(updatedElements, element => {
        element.x += 50;
        element.y += 50;
        return element;
    });

    excalidrawApi.updateScene({
        elements: [...elements, ...movedElements],
        commitToHistory: true,
        appState: updatedState,
    });
};

export type ArrowKey = "ArrowRight" | "ArrowLeft" | "ArrowUp" | "ArrowDown";

const handleMetaArrow = (
    event: KeyboardEvent,
    direction: ArrowKey,
    excalidrawApi: ExcalidrawImperativeAPI
) => {
    const elements = excalidrawApi.getSceneElements();
    const state = excalidrawApi.getAppState();

    const selectedIds = ElementStateUtil.getSelectedElementIds(state);
    const selectedElements = elements.filter(element => selectedIds.includes(element.id));

    if (selectedElements.length === 0) return;

    const positions = ElementPositionUtil.getPositionFromElements(selectedElements);

    const elementToConnectPosition = positions.elements.reduce<Maybe<ElementPosition>>(
        (acc, element) => {
            if (!acc) return element;

            // TODO: furthest right for now
            if (element.positions.endX > acc.positions.endX) {
                return element;
            }
            return acc;
        },
        undefined
    );

    if (!elementToConnectPosition) return;

    const elementToConnect = selectedElements.find(
        element => element.id === elementToConnectPosition.id
    );

    if (!elementToConnect) return;

    const arrowId = ElementUtil.createElementId();

    // @ts-ignore
    if (!elementToConnect.boundElements) {
        // @ts-ignore
        elementToConnect.boundElements = [{ id: arrowId, type: "arrow" }];
    } else {
        // @ts-ignore
        elementToConnect.boundElements.push({ id: arrowId, type: "arrow" });
    }

    const arrowStartX = elementToConnect.x + elementToConnect.width;
    const y = elementToConnect.y + elementToConnect.height / 2;
    const arrowLength = 100;
    const gap = 10;

    const newElementHeight = Math.max(elementToConnect.height, 100);
    const newElementWidth = Math.max(elementToConnect.width, 200);

    const newElement = ElementCreationUtil.createRectangle({
        height: newElementHeight,
        width: newElementWidth,
        x: arrowStartX + arrowLength + gap * 2,
        y: y - newElementHeight / 2, // center
        roughness: 1,
        strokeWidth: 2,
    });

    // @ts-ignore
    newElement.roundness = { type: 3 };

    // @ts-ignore
    if (!newElement.boundElements) {
        // @ts-ignore
        newElement.boundElements = [{ id: arrowId, type: "arrow" }];
    } else {
        // @ts-ignore
        newElement.boundElements.push({ id: arrowId, type: "arrow" });
    }

    const arrow = ElementCreationUtil.createArrow({
        x: arrowStartX + gap,
        y,
        points: [
            [0, 0],
            [arrowLength, 0],
        ],
    });

    // @ts-ignore
    arrow.startBinding = {
        elementId: elementToConnectPosition.id,
        focus: 0.2,
        gap,
    };

    // @ts-ignore
    arrow.endBinding = {
        elementId: newElement.id,
        focus: 0.2,
        gap,
    };

    // @ts-ignore
    arrow.id = arrowId;

    const { updatedState } = ElementUtil.createNewElementSelection([newElement], state);

    excalidrawApi.updateScene({
        elements: [...elements, arrow, newElement],
        commitToHistory: true,
        appState: updatedState,
    });
};

export const KeyboardUtil = { handleMetaEnter, handleMetaArrow };
