import { isDefined } from "@banjoanton/utils";
import { AppState } from "@excalidraw/excalidraw/types/types";
import { Board } from "../model/board";
import { BoardDeltaUpdate } from "../model/board-delta-update";
import { ExcalidrawSimpleElement } from "../model/excalidraw-simple-element";

const getSelectedElementIds = (state: AppState) => Object.keys(state.selectedElementIds);

const getLockedElementIds = (state: AppState) => {
    // include if you want to lock the selected elements
    // const selectedIds = Object.keys(state.selectedElementIds);

    const editingElementsId: string[] = state.editingElement
        ? // @ts-expect-error - wrong with type, it contains a containerId in some cases
          [state.editingElement.id, state.editingElement?.containerId].filter(isDefined)
        : [];

    return editingElementsId;
};

/**
 * Apply a delta update to the locked elements, updating them with new locked elements
 * and removing the ones that are no longer locked.
 * @param previous - the previous locked elements
 * @param deltaUpdate - the delta update to apply
 */
const applyDeltaUpdate = (previous: string[], deltaUpdate: BoardDeltaUpdate): string[] => {
    const elementsToRemoveFromLockedElements = new Set(
        previous.filter(
            elementId =>
                !deltaUpdate.excalidrawElements.some(
                    element => element.id === elementId && !element.locked
                )
        )
    );
    const elementsToAddToLockedElements = deltaUpdate.excalidrawElements
        .filter(element => element.locked)
        .map(element => element.id.toString());

    const updatedLockedElements = [
        ...previous.filter(elementId => !elementsToRemoveFromLockedElements.has(elementId)),
        ...elementsToAddToLockedElements,
    ];

    return updatedLockedElements;
};

/**
 * Mark locked elements as unlocked
 * @param board - the board to update
 * @param lockedElements - the elements to unlock
 */
const restoreBoardLockedElements = (board: Board, lockedElements: string[]) => {
    const affectedUpdatedElements: ExcalidrawSimpleElement[] = [];

    const allUpdatedElements = board.elements.map(element => {
        if (lockedElements.includes(element.id.toString())) {
            const updatedElement = { ...element, locked: false };
            affectedUpdatedElements.push(updatedElement);
            return updatedElement;
        }

        return element;
    });

    const updatedBoard: Board = { ...board, elements: allUpdatedElements };

    return { updatedBoard, updatedElements: affectedUpdatedElements };
};

export const ElementStateUtil = {
    applyDeltaUpdate,
    restoreBoardLockedElements,
    getLockedElementIds,
    getSelectedElementIds,
};
