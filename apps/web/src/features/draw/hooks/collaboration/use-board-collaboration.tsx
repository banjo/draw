import { useBoardSync } from "@/features/draw/hooks/collaboration/use-board-sync";
import { useCodeEditorStore } from "@/features/selected-element-visuals/stores/use-code-editor-store";
import { useError } from "@/hooks/use-error";
import { trpc } from "@/lib/trpc";
import { useGlobalLoadingStore } from "@/stores/use-global-loading-store";
import { isDefined, Maybe } from "@banjoanton/utils";
import { AppState } from "@excalidraw/excalidraw/types/types";
import {
    BoardUpdateResponse,
    DeltaUpdateUtil,
    ExcalidrawApi,
    ExcalidrawSimpleElement,
} from "common";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type In = {
    slug?: string;
    excalidrawApi: Maybe<ExcalidrawApi>;
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

export const useBoardCollaboration = ({ slug, excalidrawApi }: In) => {
    const navigate = useNavigate();
    const { handleError } = useError();
    const { schedule, setSynced, markSynced } = useBoardSync({
        slug,
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

    /** Call when the elements changed. The changes are found and sent on a timer. */
    const onDrawingChange = () => {
        if (!slug || isLoading) return;
        schedule();
    };

    return {
        onDrawingChange,
    };
};
