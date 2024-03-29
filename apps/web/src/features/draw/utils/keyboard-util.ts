import {
    ARROW_LENGTH,
    ELEMENT_GAP,
    ELEMENT_HEIGHT,
    ELEMENT_WIDTH,
} from "@/features/draw/models/constants";
import { ElementCreationUtil } from "@/features/draw/utils/element-creation-util";
import { ElementPositionUtil } from "@/features/draw/utils/element-position-util";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { UpdateElementUtil } from "@/features/draw/utils/update-element-util";
import { clone } from "@banjoanton/utils";
import { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";

export type KeyboardEvent = React.KeyboardEvent<HTMLDivElement>;

const handleMetaEnter = (event: KeyboardEvent, excalidrawApi: ExcalidrawImperativeAPI) => {
    const elements = excalidrawApi.getSceneElements();
    const state = excalidrawApi.getAppState();

    const selectedIds = ElementUtil.getSelectedElementIds(state);
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

    const movedElements = UpdateElementUtil.updateElements(updatedElements, element => {
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

    const selectedElements = ElementUtil.getSelectedElements(state, elements);
    if (selectedElements.length === 0) return;

    const elementToConnect = ElementPositionUtil.getClosestElement(direction, selectedElements);
    if (!elementToConnect) return;

    const arrowId = ElementUtil.createElementId();

    UpdateElementUtil.updateElement(elementToConnect, (draft, helpers) => {
        helpers.addBoundElements(draft, [{ id: arrowId, type: "arrow" }]);
    });

    const arrowStartX = elementToConnect.x + elementToConnect.width;
    const y = elementToConnect.y + elementToConnect.height / 2;
    const arrowLength = ELEMENT_WIDTH;

    const newElementHeight = Math.max(elementToConnect.height, ELEMENT_HEIGHT);
    const newElementWidth = Math.max(elementToConnect.width, ELEMENT_WIDTH);

    const newElement = ElementCreationUtil.createRectangle(
        {
            height: newElementHeight,
            width: newElementWidth,
            x: arrowStartX + ARROW_LENGTH + ELEMENT_GAP * 2,
            y: y - newElementHeight / 2, // center
        },
        (draft, helpers) => {
            helpers.defaultSettings(draft);
            helpers.addBoundElements(draft, [{ id: arrowId, type: "arrow" }]);
        }
    );

    const arrow = ElementCreationUtil.createArrow(
        {
            x: arrowStartX + ELEMENT_GAP,
            y,
            points: [
                [0, 0],
                [arrowLength, 0],
            ],
        },
        (draft, helpers) => {
            helpers.addBindings(draft, { startId: elementToConnect.id, endId: newElement.id });
            draft.id = arrowId;
        }
    );

    const { updatedState } = ElementUtil.createNewElementSelection([newElement], state);

    excalidrawApi.updateScene({
        elements: [...elements, arrow, newElement],
        commitToHistory: true,
        appState: updatedState,
    });
};

export const KeyboardUtil = { handleMetaEnter, handleMetaArrow };
