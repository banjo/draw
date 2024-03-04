import { isDefined, partition } from "@banjoanton/utils";
import { Board } from "../model/board";
import { BoardDeltaUpdate } from "../model/board-delta-update";
import { ExcalidrawSimpleElement } from "../model/excalidraw-simple-element";

type ApplyToBoardProps = {
    deltaUpdate: BoardDeltaUpdate;
    board: Board;
    isOnClient: boolean;
};

const applyToBoard = ({ board, deltaUpdate, isOnClient }: ApplyToBoardProps): Board => {
    const elements = deltaUpdate.excalidrawElements;

    const [deleted, allUpdated] = partition(elements, e => e.isDeleted);
    const [updated, added] = partition(allUpdated, e => e.version > 1);
    const toDelete = new Set(deleted.map(e => e.id));
    const toUpdate = new Set(updated.map(e => e.id));

    // TODO: check version and only update if version is higher (does this logic work?)

    // TODO: might be necessary to do another implementation on client.
    // The truth is on server so always overwrite on client.

    const updatedBoardElements = board.elements
        .map(e => {
            if (toDelete.has(e.id)) {
                return undefined;
            }

            if (toUpdate.has(e.id)) {
                const updatedExcalidrawElement: ExcalidrawSimpleElement =
                    updated.find(u => u.id === e.id) ?? e;

                // always overwrite on client
                if (isOnClient) {
                    return updatedExcalidrawElement;
                }

                if (updatedExcalidrawElement.version > e.version) {
                    return updatedExcalidrawElement;
                }

                return e;
            }

            return e;
        })
        .filter(isDefined);

    const ordered = deltaUpdate.order
        .map(id => {
            const updatedElement = updatedBoardElements.find(e => e.id === id);
            if (updatedElement) {
                return updatedElement;
            }

            const addedElement = added.find(e => e.id === id);
            if (addedElement) {
                return addedElement;
            }

            return undefined;
        })
        .filter(isDefined);

    return Board.from({ elements: ordered });
};

export const DeltaUpdateUtil = {
    applyToBoard,
};
