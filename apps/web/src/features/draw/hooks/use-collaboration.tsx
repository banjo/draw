import { useBoardCollaboration } from "@/features/draw/hooks/use-board-collaboration";
import { ExcalidrawElements } from "@/features/draw/hooks/use-elements-state";
import { usePointerCollaboration } from "@/features/draw/hooks/use-pointer-collaboration";
import { Maybe, noop, uuid } from "@banjoanton/utils";
import { LiveCollaborationTrigger } from "@excalidraw/excalidraw";
import { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import { useLocalStorage } from "@uidotdev/usehooks";
import { useCallback } from "react";

type In = {
    slug?: string;
    excalidrawApi: Maybe<ExcalidrawImperativeAPI>;
    setElements: (elements: ExcalidrawElements) => void;
    elements: ExcalidrawElements;
};

const ID_KEY = "banjo-collab-id";

export const useCollaboration = ({ slug, excalidrawApi, setElements, elements }: In) => {
    const [localId] = useLocalStorage(ID_KEY, uuid());
    const { isCollaborating, onPointerUpdate } = usePointerCollaboration({
        slug,
        excalidrawApi,
        localId,
    });

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
