import { ArrowKey } from "@/features/draw/hooks/base/use-keyboard";
import React from "react";
import { AppState } from "@excalidraw/excalidraw/types/types";

const DISTANCE_FROM_LINE = 30;

type HandlerProps = {
    x: number;
    y: number;
    width: number;
    height: number;
    ref: React.RefObject<HTMLDivElement>;
    appState: AppState;
};
type Out = {
    refX: number;
    refY: number;
};
type Handler = (props: HandlerProps) => Out;
const positionMap: Record<ArrowKey, Handler> = {
    ArrowUp: ({ ref, width, appState, x, y }) => {
        const refWidth = ref.current?.offsetWidth ?? 0;
        const refHeight = ref.current?.offsetHeight ?? 0;
        const refX = x + (width * appState.zoom.value) / 2 - refWidth / 2;
        const refY = y - refHeight - DISTANCE_FROM_LINE;

        return {
            refX,
            refY,
        };
    },
    ArrowRight: ({ ref, width, appState, x, y, height }) => {
        const refHeight = ref.current?.offsetHeight ?? 0;

        const refY = y + (height * appState.zoom.value) / 2 - refHeight / 2;
        const refX = x + width * appState.zoom.value + DISTANCE_FROM_LINE;

        return {
            refX,
            refY,
        };
    },
    ArrowDown: ({ ref, width, appState, x, y, height }) => {
        const refWidth = ref.current?.offsetWidth ?? 0;
        const refX = x + (width * appState.zoom.value) / 2 - refWidth / 2;
        const refY = y + height * appState.zoom.value + DISTANCE_FROM_LINE;

        return {
            refX,
            refY,
        };
    },
    ArrowLeft: ({ ref, width, appState, x, y, height }) => {
        const refWidth = ref.current?.offsetWidth ?? 0;
        const refHeight = ref.current?.offsetHeight ?? 0;

        const refY = y + (height * appState.zoom.value) / 2 - refHeight / 2;
        const refX = x - refWidth - DISTANCE_FROM_LINE;

        return {
            refX,
            refY,
        };
    },
};

export const getExtendElementHandler = (type: ArrowKey) => positionMap[type];
