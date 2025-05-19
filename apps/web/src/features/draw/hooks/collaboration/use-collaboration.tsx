import { useGlobal } from "@/contexts/global-context";
import { useBoardCollaboration } from "@/features/draw/hooks/collaboration/use-board-collaboration";
import { usePointerCollaboration } from "@/features/draw/hooks/collaboration/use-pointer-collaboration";
import { noop } from "@banjoanton/utils";
import { LiveCollaborationTrigger } from "@excalidraw/excalidraw";
import { ExcalidrawElements } from "common";
import { useCallback } from "react";

type In = {
    slug?: string;
    setElements: (elements: ExcalidrawElements) => void;
    elements: ExcalidrawElements;
};

export const useCollaboration = ({ slug, setElements, elements }: In) => {
    const { excalidrawApi } = useGlobal();

    const { isCollaborating, onPointerUpdate } = usePointerCollaboration({
        slug,
        excalidrawApi,
    });

    // TODO: show error and navigate to / if it does not work (turn off api and try to start)
    const { onDrawingChange } = useBoardCollaboration({
        elements,
        excalidrawApi,
        setElements,
        slug,
    });

    const renderCollabButton = useCallback(
        () => (
            <LiveCollaborationTrigger
                isCollaborating={isCollaborating ? Boolean(slug) : false}
                onSelect={noop}
            />
        ),
        [isCollaborating, excalidrawApi]
    );

    return {
        isCollaborating,
        onPointerUpdate,
        renderCollabButton,
        onDrawingChange,
    };
};
