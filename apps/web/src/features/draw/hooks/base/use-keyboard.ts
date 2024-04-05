import { useGlobal } from "@/contexts/global-context";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { ElementExtensionShadow, ElementVisualUtils } from "@/features/draw/utils/keyboard-util";
import { useChangeElementStore } from "@/stores/use-change-element-store";
import { Callback, Maybe, includes } from "@banjoanton/utils";
import { KeyboardEventHandler, useState } from "react";

type In = {
    handleChangeElementDialogClick: Callback;
};

export const ARROW_KEYS = ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"] as const;
export type ArrowKey = (typeof ARROW_KEYS)[number];

export const useKeyboard = ({ handleChangeElementDialogClick }: In) => {
    const { excalidrawApi } = useGlobal();
    const [shadowElements, setShadowElements] = useState<Maybe<ElementExtensionShadow>>(undefined);
    const setShowChangeElementDialog = useChangeElementStore(
        state => state.setShowChangeElementDialog
    );
    const setMetaKeyIsDown = useChangeElementStore(state => state.setMetaKeyIsDown);

    const handleKeyDown: KeyboardEventHandler<HTMLDivElement> = event => {
        if (!excalidrawApi) return;

        console.log(excalidrawApi.getSceneElements());
        console.log(excalidrawApi.getAppState());

        const state = excalidrawApi.getAppState();

        if (event.key === "Meta") {
            setShowChangeElementDialog(false);
            setMetaKeyIsDown(true);
        }

        // If one element selected, allow change element type
        if (ElementUtil.getSelectedElementIds(state).length === 1 && event.key === "Tab") {
            handleChangeElementDialogClick();
        }

        if (event.metaKey && event.key === "Enter") {
            ElementVisualUtils.smartCopy(excalidrawApi);
            return;
        }

        if (event.metaKey && includes(ARROW_KEYS, event.key)) {
            const result = ElementVisualUtils.createElementExtensionShadow(
                event.key,
                excalidrawApi,
                shadowElements
            );

            setShadowElements(result);
            return;
        }
    };

    const handleKeyUp: KeyboardEventHandler<HTMLDivElement> = event => {
        if (!excalidrawApi) return;

        if (event.key === "Meta") {
            setShowChangeElementDialog(true);
            setMetaKeyIsDown(false);
        }

        // finalize arrow creation
        if (shadowElements && event.key === "Meta") {
            ElementVisualUtils.createElementExtensionFromShadow(shadowElements, excalidrawApi);
            setShadowElements(undefined);
            return;
        }
    };

    return {
        handleKeyDown,
        handleKeyUp,
    };
};
