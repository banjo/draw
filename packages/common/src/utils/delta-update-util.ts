import { isDefined, partition } from "@banjoanton/utils";
import { Board } from "../model/board";
import { BoardDeltaUpdate } from "../model/board-delta-update";
import { ExcalidrawSimpleElement } from "../model/excalidraw-simple-element";
import { createLogger } from "../lib/logger";

type ApplyToBoardProps = {
    deltaUpdate: BoardDeltaUpdate;
    board: Board;
    isOnClient: boolean;
};

const logger = createLogger("delta-update-util");

const applyToBoard = ({ board, deltaUpdate, isOnClient }: ApplyToBoardProps): Board => {
    const elements = deltaUpdate.excalidrawElements;

    const [deleted, allUpdated] = partition(elements, e => e.isDeleted);
    const [updated, added] = partition(allUpdated, e => board.elements.some(b => b.id === e.id));
    const toDelete = new Set(deleted.map(e => e.id));
    const toUpdate = new Set(updated.map(e => e.id));

    // TODO: this is a bit inefficient, we could just loop through the updated elements and update the board
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

    if (deltaUpdate.order) {
        const ordered = deltaUpdate.order
            .map(id => {
                const addedElement = added.find(e => e.id === id);
                if (addedElement) {
                    return addedElement;
                }

                const updatedElement = updatedBoardElements.find(e => e.id === id);
                if (updatedElement) {
                    return updatedElement;
                }

                logger.trace(`Element with id ${id} not found in delta update`);
                return undefined;
            })
            .filter(isDefined);

        return Board.from({ elements: ordered });
    }

    return Board.from({ elements: updatedBoardElements });
};

export const DeltaUpdateUtil = {
    applyToBoard,
};
