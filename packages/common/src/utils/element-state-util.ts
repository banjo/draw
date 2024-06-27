import { Board } from "../model/board";
import { BoardDeltaUpdate } from "../model/board-delta-update";
import { ExcalidrawSimpleElement } from "../model/excalidraw-simple-element";

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

export const ElementStateUtil = {
    applyDeltaUpdate,
};
