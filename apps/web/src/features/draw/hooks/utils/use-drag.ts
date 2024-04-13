import { useEffect, useRef, useState } from "react";

export type DragPosition = {
    x: number;
    y: number;
};

type Props = {
    onDragStart?: (position: DragPosition) => void;
    onDrag?: (position: DragPosition) => void;
    onDragEnd?: (position: DragPosition) => void;
    onClick?: () => void;
    relativeToStart: boolean;
    clickThreshold?: number;
};

export const useDrag = (props?: Props) => {
    const {
        onDragStart,
        onDrag,
        onDragEnd,
        onClick,
        relativeToStart,
        clickThreshold = 5,
    } = props ?? {};

    const [startPosition, setStartPosition] = useState<DragPosition>({ x: 0, y: 0 });
    const [dragPosition, setDragPosition] = useState<DragPosition>({ x: 0, y: 0 });

    // Use a ref for the isDragging state to ensure up-to-date access in event listeners
    const isDraggingRef = useRef(false);
    // Additionally, keep isDragging in state if you need to trigger re-renders or effects based on its value
    const [isDragging, setIsDragging] = useState(false);

    // update ref when props change
    useEffect(() => {
        isDraggingRef.current = isDragging;
    }, [isDragging]);

    const handleMouseMove = (e: React.MouseEvent | MouseEvent) => {
        if (!isDraggingRef.current) {
            const moveX = Math.abs(e.clientX - startPosition.x);
            const moveY = Math.abs(e.clientY - startPosition.y);
            if (moveX > clickThreshold || moveY > clickThreshold) {
                setIsDragging(true);
                onDragStart?.(startPosition);
            }
        }

        if (isDraggingRef.current) {
            const newDragPosition: DragPosition = relativeToStart
                ? {
                      x: e.clientX - startPosition.x,
                      y: e.clientY - startPosition.y,
                  }
                : {
                      x: e.clientX,
                      y: e.clientY,
                  };

            setDragPosition(newDragPosition);
            onDrag?.(newDragPosition);
        }
    };

    const handleMouseUp = (e: React.MouseEvent | MouseEvent) => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);

        if (isDraggingRef.current) {
            setIsDragging(false);

            const newDragPosition = relativeToStart
                ? {
                      x: e.clientX - startPosition.x,
                      y: e.clientY - startPosition.y,
                  }
                : {
                      x: e.clientX,
                      y: e.clientY,
                  };
            onDragEnd?.(newDragPosition);
        } else {
            onClick?.();
        }
    };

    const onMouseDown = (e: React.MouseEvent | MouseEvent) => {
        setStartPosition({
            x: e.clientX,
            y: e.clientY,
        });

        // Make sure to clear isDraggingRef state in case it was left in an inconsistent state
        setIsDragging(false);
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
    };

    // Cleanup event listeners when the component unmounts
    useEffect(() => {
        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, []);

    // event listener necessary for drag to work
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
