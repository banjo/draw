import { useGlobal } from "@/contexts/global-context";
import { ExcalidrawElement } from "@/features/draw/models/element";
import { ElementPositionUtil } from "@/features/draw/utils/element-position-util";
import { useEffect, useRef, useState } from "react";

export const useSelectElementDialog = () => {
    const { excalidrawApi } = useGlobal();
    const selectElementRef = useRef<HTMLDivElement>(null);
    const [showSelectElementDialog, setShowSelectElementDialog] = useState(false);

    // Focus on the dialog when it is shown
    useEffect(() => {
        if (showSelectElementDialog) {
            selectElementRef.current?.setAttribute("tabIndex", "-1");
            selectElementRef.current?.focus();
        }
    }, [showSelectElementDialog]);

    const applyPosition = (selectedElement: ExcalidrawElement) => {
        if (!excalidrawApi) return;
        const appState = excalidrawApi.getAppState();
        const { width, height } = ElementPositionUtil.getPositionFromElement(selectedElement);
        const { x, y } = ElementPositionUtil.getElementWindowPosition(selectedElement, appState);

        // place select element dialog under the element
        const selectWidth = selectElementRef.current?.offsetWidth ?? 0;
        const selectX = x + (width * appState.zoom.value) / 2 - selectWidth / 2;
        const selectY = y + height + 20;
        selectElementRef.current?.setAttribute("style", `top: ${selectY}px; left: ${selectX}px`);
    };

    return {
        selectElementRef,
        showSelectElementDialog,
        setShowSelectElementDialog,
        applyPosition,
    };
};
