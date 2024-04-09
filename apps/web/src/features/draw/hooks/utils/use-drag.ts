import { useEffect, useState } from "react";

export type DragPosition = {
    x: number;
    y: number;
};

type Props = {
    onDragStart?: (position: DragPosition) => void;
    onDrag?: (position: DragPosition) => void;
    onDragEnd?: (position: DragPosition) => void;
    relativeToStart?: boolean;
};

export const useDrag = (props?: Props) => {
    const { onDragStart, onDrag, onDragEnd } = props ?? {};
    const [isDragging, setIsDragging] = useState(false);
    const [startPosition, setStartPosition] = useState<DragPosition>({ x: 0, y: 0 });
    const [dragPosition, setDragPosition] = useState<DragPosition>({ x: 0, y: 0 });

    const handleMouseMove = (e: React.MouseEvent | MouseEvent) => {
        if (isDragging) {
            const newDragPosition = {
                x: e.clientX - startPosition.x,
                y: e.clientY - startPosition.y,
            };

            setDragPosition(newDragPosition);
            onDrag?.(newDragPosition);
        }
    };

    const handleMouseUp = (e: React.MouseEvent | MouseEvent) => {
        setIsDragging(false);

        const newDragPosition = {
            x: e.clientX - startPosition.x,
            y: e.clientY - startPosition.y,
        };
        onDragEnd?.(newDragPosition);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
    };

    const onMouseDown = (e: React.MouseEvent | MouseEvent) => {
        setIsDragging(true);
        setStartPosition({
            x: e.clientX,
            y: e.clientY,
        });
        onDragStart?.({ x: e.clientX, y: e.clientY });
    };

    useEffect(() => {
        if (isDragging) {
            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);
        }
    }, [isDragging]);

    return {
        isDragging,
        dragPosition,
        onMouseDown,
    };
};

export type UseDragReturnProps = ReturnType<typeof useDrag>;
