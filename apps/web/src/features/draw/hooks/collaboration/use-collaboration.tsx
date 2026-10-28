import { useGlobal } from "@/contexts/global-context";
import { useBoardCollaboration } from "@/features/draw/hooks/collaboration/use-board-collaboration";
import { usePointerCollaboration } from "@/features/draw/hooks/collaboration/use-pointer-collaboration";
import { LiveCollaborationTrigger } from "@excalidraw/excalidraw";
import { useMemo } from "react";

type In = {
    slug?: string;
    onShare: () => void;
};

export const useCollaboration = ({ slug, onShare }: In) => {
    const { excalidrawApi } = useGlobal();

    const { isCollaborating, onPointerUpdate } = usePointerCollaboration({
        slug,
        excalidrawApi,
    });

    // TODO: show error and navigate to / if it does not work (turn off api and try to start)
    const { onDrawingChange } = useBoardCollaboration({
        excalidrawApi,
        slug,
    });

    const collabButton = useMemo(
        () => (
            <LiveCollaborationTrigger
                isCollaborating={isCollaborating ? Boolean(slug) : false}
                onSelect={onShare}
            />
        ),
        [isCollaborating, slug, onShare]
    );

    return {
        isCollaborating,
        onPointerUpdate,
        collabButton,
        onDrawingChange,
    };
};
