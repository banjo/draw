import { useBoardSync } from "@/features/draw/hooks/collaboration/use-board-sync";
import { useAuth } from "@/contexts/auth-context";
import { canEditDrawing } from "@/features/share/stores/use-drawing-access-store";
import { useCodeEditorStore } from "@/features/selected-element-visuals/stores/use-code-editor-store";
import { useError } from "@/hooks/use-error";
import { trpc } from "@/lib/trpc";
import { useGlobalLoadingStore } from "@/stores/use-global-loading-store";
import { useSignInModalStore } from "@/stores/use-sign-in-modal-store";
import { isDefined, Maybe } from "@banjoanton/utils";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { AppState } from "@excalidraw/excalidraw/types";
import {
    BoardUpdateResponse,
    Cause,
    DeltaUpdateUtil,
    ExcalidrawApi,
    ExcalidrawSimpleElement,
} from "common";
import { useEffect } from "react";
import toast from "react-hot-toast";
import { useLocation, useNavigate } from "react-router-dom";

const LOAD_TIMEOUT = 20_000;

type In = {
    slug?: string;
    excalidrawApi: Maybe<ExcalidrawApi>;
};

/** Elements the user is changing right now, which a remote update shouldn't overwrite */
const getBusyElementIds = (appState: AppState) =>
    new Set(
        [
            appState.editingTextElement?.id,
            appState.editingLinearElement?.elementId,
            appState.newElement?.id,
            appState.resizingElement?.id,
            useCodeEditorStore.getState().editingElementId,
        ].filter(isDefined)
    );

export const useBoardCollaboration = ({ slug, excalidrawApi }: In) => {
    const navigate = useNavigate();
    const { handleError } = useError();
    const utils = trpc.useUtils();
    const { isAuthenticated } = useAuth();
    const setShowSignInModal = useSignInModalStore(s => s.setShowSignInModal);
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
        // Don't leave the overlay up for the next drawing
        return () => setIsLoading(false);
    }, [slug]);

    // The board may never arrive, e.g. when the API is down, so don't load forever
    useEffect(() => {
        if (!slug || !isLoading) return;

        const timer = setTimeout(() => {
            setIsLoading(false);
            toast.error("Could not load the drawing. Check your connection and try again.");
            navigate("/");
        }, LOAD_TIMEOUT);
        return () => clearTimeout(timer);
    }, [slug, isLoading]);

    const input = { slug: slug ?? "" };
    trpc.collaboration.onBoardChange.useSubscription(input, {
        // The full board is dropped without the API, which would leave the loading overlay up
        enabled: isDefined(slug) && isDefined(excalidrawApi),
        onData: update => {
            if (!slug || !excalidrawApi) return;

            // The owner changed who can open the drawing while you're on it
            if (BoardUpdateResponse.isAccess(update)) {
                utils.access.get.setData({ slug }, data =>
                    data ? { ...data, role: update.role } : data
                );
                void utils.access.get.invalidate({ slug });
                return;
            }

            if (BoardUpdateResponse.isFullBoard(update)) {
                const boardElements = ExcalidrawSimpleElement.toExcalidrawElements(
                    update.board.elements
                );

                setSynced(boardElements);
                // Not undoable: undo should only take back your own changes
                excalidrawApi.updateScene({
                    elements: boardElements,
                    captureUpdate: CaptureUpdateAction.NEVER,
                });
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
            excalidrawApi.updateScene({
                elements: after,
                captureUpdate: CaptureUpdateAction.NEVER,
            });
        },
        onError: error => {
            setIsLoading(false);
            handleError(error, { toast: true });
            // Signing in may give access, if it's your own drawing
            if (error.shape?.cause === Cause.NO_ACCESS && !isAuthenticated) {
                setShowSignInModal(true);
            }
            navigate("/");
        },
    });

    /** Call when the elements changed. The changes are found and sent on a timer. */
    const onDrawingChange = () => {
        if (!slug || isLoading || !canEditDrawing()) return;
        schedule();
    };

    return {
        onDrawingChange,
    };
};
