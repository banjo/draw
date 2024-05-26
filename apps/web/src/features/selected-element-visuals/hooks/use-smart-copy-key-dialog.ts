import { useGlobal } from "@/contexts/global-context";
import { ElementPositionUtil } from "@/features/draw/utils/element-position-util";
import { useVisualElementTimer } from "@/features/selected-element-visuals/hooks/use-visual-element-timer";
import { useVisualElementStore } from "@/stores/use-visual-element-store";
import { ExcalidrawElement } from "common";
import { useRef } from "react";

export const useSmartCopyKeyDialog = () => {
    const { excalidrawApi } = useGlobal();
    const smartCopyKeyDialogRef = useRef<HTMLDivElement>(null);
    const setShowSmartCopyDialog = useVisualElementStore(s => s.setShowVisualElements);
    const showSmartCopyKeyDialogByGlobalState = useVisualElementStore(s => s.showVisualElements);

    const { showChangeElementByTime } = useVisualElementTimer();

    const showSmartCopyDialog = showSmartCopyKeyDialogByGlobalState && showChangeElementByTime;

    const applyPosition = (selectedElement: ExcalidrawElement) => {
        if (!excalidrawApi) return;

        const appState = excalidrawApi.getAppState();
        const { width, height } = ElementPositionUtil.getPositionFromElement(selectedElement);
        const { x, y } = ElementPositionUtil.getElementWindowPosition(selectedElement, appState);

        // make sure the element is centered as well and count for zoom
        const dialogWidth = smartCopyKeyDialogRef.current?.offsetWidth ?? 0;
        const dialogX = x + (width * appState.zoom.value) / 2 - dialogWidth / 2;

        // place dialog under the element
        const dialogY = y + height + 50;

        smartCopyKeyDialogRef.current?.setAttribute(
            "style",
            `top: ${dialogY}px; left: ${dialogX}px`
        );
    };

    return {
        smartCopyKeyDialogRef,
        showSmartCopyDialog,
        setShowSmartCopyDialog,
        applyPosition,
    };
};
