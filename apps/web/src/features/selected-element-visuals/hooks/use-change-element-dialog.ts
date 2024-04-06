import { useGlobal } from "@/contexts/global-context";
import { ExcalidrawElement } from "@/features/draw/models/element";
import { ElementPositionUtil } from "@/features/draw/utils/element-position-util";
import { useChangeElementTimer } from "@/features/selected-element-visuals/hooks/use-change-element-timer";
import { useChangeElementStore } from "@/stores/use-change-element-store";
import { useRef } from "react";

export const useChangeElementDialog = () => {
    const { excalidrawApi } = useGlobal();
    const changeElementRef = useRef<HTMLDivElement>(null);
    const setShowChangeElementDialog = useChangeElementStore(s => s.setShowChangeElementDialog);
    const showChangeElementDialogByGlobalState = useChangeElementStore(
        s => s.showChangeElementDialog
    );

    const { showChangeElementByTime } = useChangeElementTimer();

    const showChangeElementDialog = showChangeElementDialogByGlobalState && showChangeElementByTime;

    const applyPosition = (selectedElement: ExcalidrawElement) => {
        if (!excalidrawApi) return;

        const appState = excalidrawApi.getAppState();
        const { width, height } = ElementPositionUtil.getPositionFromElement(selectedElement);
        const { x, y } = ElementPositionUtil.getElementWindowPosition(selectedElement, appState);

        // make sure the element is centered as well and count for zoom
        const dialogWidth = changeElementRef.current?.offsetWidth ?? 0;
        const dialogX = x + (width * appState.zoom.value) / 2 - dialogWidth / 2;

        // place dialog above the element
        const dialogY = y - 100;

        changeElementRef.current?.setAttribute("style", `top: ${dialogY}px; left: ${dialogX}px`);
    };

    return {
        changeElementRef,
        showChangeElementDialog,
        setShowChangeElementDialog,
        applyPosition,
    };
};
