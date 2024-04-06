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

    // remember previous elements with lock to be able to send to server when it changes
    const [previousLockedElements, setPreviousLockedElements] = useState<string[]>([]);
    const { isLoading, setIsLoading } = useGlobalLoadingStore();

    useEffect(() => {
        // do not load drawing when navigating to local
        if (pathname === "/") return;
        setIsLoading(true, "Loading drawing...");
    }, [slug]);

    useEffect(() => {
        if (!excalidrawApi) return;
        setPreviousLockedElements(ElementUtil.getLockedElementIds(excalidrawApi.getAppState()));
    }, [slug, excalidrawApi]);

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
        const changes = DrawingUtil.getChangesWithLockedElements({
            newElements: e,
            oldElements: elements,
            newState: state,
            previousLockedElements: previousLockedElements,
        });

        const {
            allNewElements,
            allOldElements,
            elementsUpdated,
            lockStateHasChanged,
            currentLockedElements,
        } = changes;

        if (!elementsUpdated && !lockStateHasChanged) return;

        setElements(allNewElements);
        setPreviousLockedElements(currentLockedElements);

        // rest is only for collaboration
        if (!slug) return;
        if (isLoading) return;

        const { currentOrder, elementsToSave } = DrawingUtil.prepareCollaborationChanges({
            allNewElements,
            allOldElements,
            currentLockedElements,
            previousLockedElements,
        });

        const deltaBoardUpdate = BoardDeltaUpdate.from({
            excalidrawElements: elementsToSave,
            order: currentOrder,
            senderId: localId,
        });

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
