import { useCallback, useRef, useState } from "react";
import React from "react";

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

/**
 * Mouse dragging. A drag starts once the mouse moves more than `clickThreshold` pixels from
 * where it went down; otherwise releasing it counts as a click.
 *
 * The listeners stay until the mouse is released, even if the component unmounts: the
 * extend buttons are hidden as soon as an arrow is dragged out of them, and the drag
 * still has to finish.
 */
export const useDrag = (props?: Props) => {
    // The listeners live on the document for the whole drag, so they read the latest props
    const latest = useRef(props);
    latest.current = props;

    const startPosition = useRef<DragPosition>({ x: 0, y: 0 });
    const isDraggingRef = useRef(false);
    const [isDragging, setIsDragging] = useState(false);
    const [dragPosition, setDragPosition] = useState<DragPosition>({ x: 0, y: 0 });

    const getPosition = (e: MouseEvent): DragPosition =>
        latest.current?.relativeToStart
            ? { x: e.clientX - startPosition.current.x, y: e.clientY - startPosition.current.y }
            : { x: e.clientX, y: e.clientY };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDraggingRef.current) {
            const threshold = latest.current?.clickThreshold ?? 5;
            const moveX = Math.abs(e.clientX - startPosition.current.x);
            const moveY = Math.abs(e.clientY - startPosition.current.y);
            if (moveX <= threshold && moveY <= threshold) return;

            isDraggingRef.current = true;
            setIsDragging(true);
            latest.current?.onDragStart?.(startPosition.current);
        }

        const position = getPosition(e);
        setDragPosition(position);
        latest.current?.onDrag?.(position);
    }, []);

    const handleMouseUp = useCallback((e: MouseEvent) => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);

        if (isDraggingRef.current) {
            isDraggingRef.current = false;
            setIsDragging(false);
            latest.current?.onDragEnd?.(getPosition(e));
        } else {
            latest.current?.onClick?.();
        }
    }, []);

    const onMouseDown = useCallback((e: React.MouseEvent | MouseEvent) => {
        startPosition.current = { x: e.clientX, y: e.clientY };
        isDraggingRef.current = false;
        setIsDragging(false);

        // Removed first, so a second mousedown can't add them twice
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
    }, []);

    return {
        isDragging,
        dragPosition,
        onMouseDown,
    };
};

export type UseDragReturnProps = ReturnType<typeof useDrag>;
