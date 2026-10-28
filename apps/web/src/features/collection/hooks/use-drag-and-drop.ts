import {
    DraggedItem,
    useCollectionDragStore,
} from "@/features/collection/stores/use-collection-drag-store";
import { DragEvent, useEffect, useState } from "react";

// Its own type, so dropping on the canvas or elsewhere doesn't add a link or text
const DRAG_TYPE = "application/x-banjodraw-collection";

/** Props that make a row draggable within the collection */
export const getDragProps = (item: DraggedItem) => ({
    draggable: true,
    onDragStart: (event: DragEvent) => {
        event.stopPropagation();
        event.dataTransfer.clearData();
        event.dataTransfer.setData(DRAG_TYPE, "");
        event.dataTransfer.effectAllowed = "move";
        useCollectionDragStore.getState().setDragged(item);
    },
    onDragEnd: () => useCollectionDragStore.getState().setDragged(null),
});

/** Props that accept a dragged row, and whether one is over it */
export const useDropTarget = (
    accepts: (item: DraggedItem) => boolean,
    onDrop: (item: DraggedItem) => void
) => {
    const dragged = useCollectionDragStore(s => s.dragged);
    const [isOver, setIsOver] = useState(false);
    const canDrop = dragged !== null && accepts(dragged);

    useEffect(() => {
        if (!dragged) setIsOver(false);
    }, [dragged]);

    return {
        isOver: isOver && canDrop,
        dropProps: {
            onDragOver: (event: DragEvent) => {
                if (!canDrop) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setIsOver(true);
            },
            onDragLeave: (event: DragEvent) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setIsOver(false);
                }
            },
            onDrop: (event: DragEvent) => {
                setIsOver(false);
                if (!dragged || !canDrop) return;
                event.preventDefault();
                useCollectionDragStore.getState().setDragged(null);
                onDrop(dragged);
            },
        },
    };
};
