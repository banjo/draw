import { useBoardSync } from "@/features/draw/hooks/collaboration/use-board-sync";
import { DrawingUtil } from "@/features/draw/utils/drawing-util";
import { useCodeEditorStore } from "@/features/selected-element-visuals/stores/use-code-editor-store";
import { useError } from "@/hooks/use-error";
import { trpc } from "@/lib/trpc";
import { useClientIdStore } from "@/stores/use-client-id-store";
import { useGlobalLoadingStore } from "@/stores/use-global-loading-store";
import { isDefined, Maybe } from "@banjoanton/utils";
import { AppState } from "@excalidraw/excalidraw/types/types";
import {
    BoardUpdateResponse,
    DeltaUpdateUtil,
    ExcalidrawApi,
    ExcalidrawElements,
    ExcalidrawSimpleElement,
} from "common";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type In = {
    slug?: string;
    excalidrawApi: Maybe<ExcalidrawApi>;
    setElements: (elements: ExcalidrawElements) => void;
    elements: ExcalidrawElements;
};

/** Elements the user is changing right now, which a remote update shouldn't overwrite */
const getBusyElementIds = (appState: AppState) =>
    new Set(
        [
            appState.editingElement?.id,
            appState.draggingElement?.id,
            appState.resizingElement?.id,
            useCodeEditorStore.getState().editingElementId,
        ].filter(isDefined)
    );

export const useBoardCollaboration = ({ slug, excalidrawApi, setElements, elements }: In) => {
    const clientId = useClientIdStore(s => s.clientId);
    const navigate = useNavigate();
    const { handleError } = useError();
    const { schedule, setSynced, markSynced } = useBoardSync({
        slug,
        clientId,
        excalidrawApi,
    });
    const { pathname } = useLocation();

    const { isLoading, setIsLoading } = useGlobalLoadingStore();

    useEffect(() => {
        // do not load drawing when navigating to local
        if (pathname === "/") return;
        setIsLoading(true, "Loading drawing...");
    }, [slug]);

    const input = { slug: slug ?? "" };
    trpc.collaboration.onBoardChange.useSubscription(input, {
        // The full board is dropped without the API, which would leave the loading overlay up
        enabled: isDefined(slug) && isDefined(excalidrawApi),
        onData: update => {
            if (!slug || !excalidrawApi) return;

            if (BoardUpdateResponse.isFullBoard(update)) {
                const boardElements = ExcalidrawSimpleElement.toExcalidrawElements(
                    update.board.elements
                );

                setSynced(boardElements);
                excalidrawApi.updateScene({ elements: boardElements });
                setIsLoading(false);
                return;
            }

            if (update.delta.clientId === clientId) return;

            // Merge into the live scene, which also has local changes that aren't sent yet
            const before = excalidrawApi.getSceneElementsIncludingDeleted();
            const busy = getBusyElementIds(excalidrawApi.getAppState());
            const { elements: after, applied } = DeltaUpdateUtil.mergeElements({
                elements: before,
                incoming: ExcalidrawSimpleElement.toExcalidrawElements(
                    update.delta.excalidrawElements
                ),
                order: update.delta.order,
                keep: id => busy.has(id),
            });

            if (applied.length === 0 && !update.delta.order) return;

            markSynced(applied, before, after);
            excalidrawApi.updateScene({ elements: after });
        },
        onError: error => {
            setIsLoading(false);
            handleError(error, { toast: true });
            navigate("/");
        },
    });

    const onDrawingChange = (e: ExcalidrawElements, state: AppState) => {
        const { allNewElements, elementsUpdated } = DrawingUtil.getChanges({
            newElements: e,
            oldElements: elements,
            newState: state,
        });

        if (elementsUpdated) {
            setElements(allNewElements);
        }

        // rest is only for collaboration
        if (!slug) return;
        if (isLoading) return;

        schedule();
    };

    return {
        onDrawingChange,
    };
};
