import { useDeltaMutation } from "@/features/draw/hooks/collaboration/use-delta-mutation";
import { DrawingUtil } from "@/features/draw/utils/drawing-util";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { useError } from "@/hooks/use-error";
import { trpc } from "@/lib/trpc";
import { useGlobalLoadingStore } from "@/stores/use-global-loading-store";
import { Maybe, isDefined } from "@banjoanton/utils";
import { AppState } from "@excalidraw/excalidraw/types/types";
import {
    Board,
    BoardDeltaUpdate,
    BoardUpdateResponse,
    DeltaUpdateUtil,
    ExcalidrawApi,
    ExcalidrawElements,
    ExcalidrawSimpleElement,
} from "common";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type In = {
    slug?: string;
    excalidrawApi: Maybe<ExcalidrawApi>;
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
    const { pathname } = useLocation();

    const { isLoading, setIsLoading } = useGlobalLoadingStore();

    useEffect(() => {
        // do not load drawing when navigating to local
        if (pathname === "/") return;
        setIsLoading(true, "Loading drawing...");
    }, [slug]);

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

                    const cloned = structuredClone(elements);
                    setElements(cloned);
                    setIsLoading(false);
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

    const onDrawingChange = async (e: ExcalidrawElements, state: AppState) => {
        const changes = DrawingUtil.getChanges({
            newElements: e,
            oldElements: elements,
            newState: state,
        });

        const { allNewElements, allOldElements, elementsUpdated } = changes;

        if (!elementsUpdated) return;

        setElements(allNewElements);

        // rest is only for collaboration
        if (!slug) return;
        if (isLoading) return;

        const { currentOrder, elementsToSave } = DrawingUtil.prepareCollaborationChanges({
            allNewElements,
            allOldElements,
        });

        const deltaBoardUpdate = BoardDeltaUpdate.from({
            excalidrawElements: elementsToSave,
            order: currentOrder,
            senderId: localId,
        });

        mutateDeltaUpdateWithDebounce(deltaBoardUpdate);
    };

    return {
        onDrawingChange,
    };
};
