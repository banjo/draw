import { ElementPositionUtil } from "@/features/draw/utils/element-position-util";
import { useChangeElementTimer } from "@/features/selected-element-visuals/hooks/use-change-element-timer";
import { useChangeElementStore } from "@/stores/use-change-element-store";
import { Maybe } from "@banjoanton/utils";
import { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import { useRef } from "react";

type Props = {
    excalidrawApi: Maybe<ExcalidrawImperativeAPI>;
};

export const useChangeElementDialog = ({ excalidrawApi }: Props) => {
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
        const dialogY = y - 80;

        changeElementRef.current?.setAttribute("style", `top: ${dialogY}px; left: ${dialogX}px`);
    };

    return {
        changeElementRef,
        showChangeElementDialog,
        setShowChangeElementDialog,
        applyPosition,
    };
};
