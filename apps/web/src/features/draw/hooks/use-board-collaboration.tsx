import { ExcalidrawElements } from "@/features/draw/hooks/use-elements-state";
import { removeDeletedElements } from "@/features/draw/utils/element-utils";
import { trpc } from "@/lib/trpc";
import { Maybe, isDefined, isEqual } from "@banjoanton/utils";
import { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import { useDebounce } from "@uidotdev/usehooks";
import { useEffect, useState } from "react";
import {
    Board,
    BoardDeltaUpdate,
    BoardUpdateResponse,
    DeltaUpdateUtil,
    ExcalidrawSimpleElement,
} from "utils";

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
    trpc.collaboration.onBoardChange.useSubscription(
        { slug: slug ?? "", id: localId },
        {
            enabled: isDefined(slug),
            onData: update => {
                if (!slug || !excalidrawApi) return;

                if (BoardUpdateResponse.isFullBoard(update)) {
                    excalidrawApi.updateScene({
                        elements: ExcalidrawSimpleElement.toExcalidrawElements(
                            update.board.elements
                        ),
                    });
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
                console.error({ error });
            },
        }
    );

    const updateBoard = trpc.collaboration.updateBoard.useMutation();

    const [deltaUpdate, setDeltaUpdate] = useState<BoardDeltaUpdate>(() =>
        BoardDeltaUpdate.empty()
    );
    const debouncedDeltaUpdate = useDebounce(deltaUpdate, 3);

    useEffect(() => {
        if (!slug) return;
        if (isEqual(debouncedDeltaUpdate, BoardDeltaUpdate.empty())) return;

        updateBoard.mutate({ deltaBoardUpdate: debouncedDeltaUpdate, slug });
    }, [debouncedDeltaUpdate, slug]);

    const onDrawingChange = async (e: readonly ExcalidrawElement[]) => {
        const allButDeletedNewElements = removeDeletedElements(e);
        const allButDeletedOldElements = removeDeletedElements(elements);

        if (isEqual(allButDeletedNewElements, allButDeletedOldElements)) {
            return;
        }

        const updatedElements = allButDeletedNewElements.filter(newElement => {
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

        const deltaBoardUpdate = BoardDeltaUpdate.from({
            excalidrawElements: elementsToSave,
            order: currentOrder,
            senderId: localId,
        });

        setDeltaUpdate(deltaBoardUpdate);
    };

    return {
        onDrawingChange,
    };
};
