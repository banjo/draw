import { useGlobal } from "@/contexts/global-context";
import { useBoardCollaboration } from "@/features/draw/hooks/collaboration/use-board-collaboration";
import { usePointerCollaboration } from "@/features/draw/hooks/collaboration/use-pointer-collaboration";
import { noop, uuid } from "@banjoanton/utils";
import { LiveCollaborationTrigger } from "@excalidraw/excalidraw";
import { useLocalStorage } from "@uidotdev/usehooks";
import { ExcalidrawElements } from "common";
import { useCallback } from "react";

type In = {
    slug?: string;
    setElements: (elements: ExcalidrawElements) => void;
    elements: ExcalidrawElements;
};

const ID_KEY = "banjo-collab-id";

export const useCollaboration = ({ slug, setElements, elements }: In) => {
    const { excalidrawApi } = useGlobal();
    const [localId] = useLocalStorage(ID_KEY, uuid());
    const { isCollaborating, onPointerUpdate } = usePointerCollaboration({
        slug,
        excalidrawApi,
        localId,
    });

    // TODO: show error and navigate to / if it does not work (turn off api and try to start)
    const { onDrawingChange } = useBoardCollaboration({
        elements,
        excalidrawApi,
        localId,
        setElements,
        slug,
    });

    const renderCollabButton = useCallback(() => {
        return (
            <LiveCollaborationTrigger
                isCollaborating={isCollaborating && Boolean(slug)}
                onSelect={noop}
            />
        );
    }, [isCollaborating, excalidrawApi]);

    return {
        isCollaborating,
        onPointerUpdate,
        renderCollabButton,
        onDrawingChange,
    };
};
