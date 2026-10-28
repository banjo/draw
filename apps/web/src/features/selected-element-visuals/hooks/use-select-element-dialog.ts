import { useGlobal } from "@/contexts/global-context";
import { ElementPositionUtil } from "@/features/draw/utils/element-position-util";
import { ExcalidrawElement } from "common";
import { useRef, useState } from "react";

const GAP = 56;
const MARGIN = 16;

export const useSelectElementDialog = () => {
    const { excalidrawApi } = useGlobal();
    const selectElementRef = useRef<HTMLDivElement>(null);
    const [showSelectElementDialog, setShowSelectElementDialog] = useState(false);

    const applyPosition = (selectedElement: ExcalidrawElement) => {
        if (!excalidrawApi) return;
        const appState = excalidrawApi.getAppState();
        const { width } = ElementPositionUtil.getPositionFromElement(selectedElement);
        const { x, y } = ElementPositionUtil.getElementWindowPosition(selectedElement, appState);

        // Beside the element, past its + button: right if it fits, else left, and on screen
        const dialog = selectElementRef.current;
        if (!dialog) return;
        const left = x - GAP - dialog.offsetWidth;
        const right = x + width * appState.zoom.value + GAP;
        const fitsRight = right + dialog.offsetWidth <= window.innerWidth - MARGIN;
        const dialogX = fitsRight || left < MARGIN ? right : left;
        const maxY = window.innerHeight - dialog.offsetHeight - MARGIN;
        const dialogY = Math.max(MARGIN, Math.min(y, maxY));
        dialog.setAttribute("style", `top: ${dialogY}px; left: ${dialogX}px`);
    };

    return {
        selectElementRef,
        showSelectElementDialog,
        setShowSelectElementDialog,
        applyPosition,
    };
};
