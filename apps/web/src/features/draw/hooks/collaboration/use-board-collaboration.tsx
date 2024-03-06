import { ExcalidrawElements } from "@/features/draw/hooks/base/use-elements-state";
import { useDeltaMutation } from "@/features/draw/hooks/collaboration/use-delta-mutation";
import { ElementUtil } from "@/features/draw/utils/element-utils";
import { useError } from "@/hooks/use-error";
import { trpc } from "@/lib/trpc";
import { Maybe, isDefined, isEqual } from "@banjoanton/utils";
import { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import { AppState, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import {
    Board,
    BoardDeltaUpdate,
    BoardUpdateResponse,
    DeltaUpdateUtil,
    ExcalidrawSimpleElement,
} from "common";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

type In = {
    slug?: string;
    excalidrawApi: Maybe<ExcalidrawImperativeAPI>;
    setElements: (elements: ExcalidrawElements) => void;
    elements: ExcalidrawElements;
    localId: string;
};

export const useBoardCollaboration = ({
    slug,
    excalidrawApi,
    setElements,
    elements,
    localId,
}: In) => {
    const navigate = useNavigate();

    const { handleError } = useError();

    const { mutateDeltaUpdateInstantly, mutateDeltaUpdateWithDebounce } = useDeltaMutation({
        slug,
    });

    // remember previous elements with lock to be able to send to server when it changes
    const [previousElementsWithLockIds, setPreviousElementsWithLockId] = useState<string[]>([]);

    trpc.collaboration.onBoardChange.useSubscription(
        { slug: slug ?? "", id: localId },
        {
            enabled: isDefined(slug),
            onData: update => {
                if (!slug || !excalidrawApi) return;

                if (BoardUpdateResponse.isFullBoard(update)) {
                    const elements = ExcalidrawSimpleElement.toExcalidrawElements(
                        update.board.elements
                    );

                    excalidrawApi.updateScene({
                        elements,
                    });

                    setElements(structuredClone(elements));
                    return;
                }

                if (update.delta.senderId === localId) return;

                const simpleElements = ExcalidrawSimpleElement.fromMany(elements);
                const currentBoard = Board.from({ elements: simpleElements });

                const updatedBoard = DeltaUpdateUtil.applyToBoard({
                    deltaUpdate: update.delta,
                    board: currentBoard,
                    isOnClient: true,
                });
                const updatedElements = ExcalidrawSimpleElement.toExcalidrawElements(
                    updatedBoard.elements
                );

                setElements(structuredClone(updatedElements));
                excalidrawApi.updateScene({
                    elements: updatedElements,
                });
            },
            onError: error => {
                handleError(error, { toast: true });
                navigate("/");
            },
        }
    );

    const onDrawingChange = async (e: readonly ExcalidrawElement[], state: AppState) => {
        const allButDeletedNewElements = ElementUtil.removeDeletedElements(e);
        const allButDeletedOldElements = ElementUtil.removeDeletedElements(elements);
        const elementsAreUpdated = !isEqual(allButDeletedNewElements, allButDeletedOldElements);

        const activeElementsWithLock = ElementUtil.getActiveElementIds(state);
        const lockStateHasChanged = !isEqual(previousElementsWithLockIds, activeElementsWithLock);

        if (!elementsAreUpdated && !lockStateHasChanged) return;

        const affectedLockStateChangeElementIds = [
            ...previousElementsWithLockIds,
            ...activeElementsWithLock,
        ];

        // update elements if lock state changed or if the elements are updated
        const updatedElements = allButDeletedNewElements.filter(newElement => {
            if (affectedLockStateChangeElementIds.includes(newElement.id)) return true;
            const oldElement = allButDeletedOldElements.find(el => el.id === newElement.id);
            if (!oldElement) return true;
            if (oldElement.version < newElement.version) return true;
            return false;
        });

        const elementsToDelete = allButDeletedOldElements
            .filter(oldElement => {
                const newElement = allButDeletedNewElements.find(el => el.id === oldElement.id);
                if (!newElement) return true;
                return false;
            })
            .map(element => ({ ...element, isDeleted: true }));

        const allElements = structuredClone(allButDeletedNewElements);
        setElements(allElements);

        if (!slug) return;

        // TODO: do not send an update one the first render, when it has fetched the board and applies it to the scene
        const currentOrder = allElements.map(e => e.id);
        const elementsToSave = [...updatedElements, ...elementsToDelete];

        // lock active elements for other users, not for the local user
        const elementsToSaveWithLocks = elementsToSave.map(element => {
            if (activeElementsWithLock.includes(element.id)) {
                return { ...element, locked: true };
            } else {
                return element;
            }
        });

        const deltaBoardUpdate = BoardDeltaUpdate.from({
            excalidrawElements: elementsToSaveWithLocks,
            order: currentOrder,
            senderId: localId,
        });

        setPreviousElementsWithLockId(activeElementsWithLock);

        if (lockStateHasChanged) {
            mutateDeltaUpdateInstantly(deltaBoardUpdate);
        } else {
            mutateDeltaUpdateWithDebounce(deltaBoardUpdate);
        }
    };

    return {
        onDrawingChange,
    };
};
