import { useGlobal } from "@/contexts/global-context";
import { ElementUtil } from "@/features/draw/utils/element-util";
import {
    ElementExtensionShadow,
    ElementVisualUtils,
} from "@/features/draw/utils/element-visual-utils";
import { useCodeEditorStore } from "@/features/selected-element-visuals/stores/use-code-editor-store";
import { useAddElementStore } from "@/stores/use-add-element-store";
import { useVisualElementStore } from "@/stores/use-visual-element-store";
import { logger } from "@/utils/logger";
import { Callback, includes, Maybe } from "@banjoanton/utils";
import { KeyboardEventHandler, useState } from "react";
import { NativeToolbarAddElementButton } from "../../models/native/native-toolbar-add-element-button";
import { CustomDataUtil } from "../../utils/custom-data-util";

type In = {
    handleChangeElementDialogClick: Callback;
};

export const ARROW_KEYS = ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"] as const;
export type ArrowKey = (typeof ARROW_KEYS)[number];

export const useKeyboard = ({ handleChangeElementDialogClick }: In) => {
    const { excalidrawApi } = useGlobal();
    const [shadowElements, setShadowElements] = useState<Maybe<ElementExtensionShadow>>(undefined);
    const setShowVisualElements = useVisualElementStore(state => state.setShowVisualElements);
    const setMetaKeyIsDown = useVisualElementStore(state => state.setMetaKeyIsDown);
    const setShowAddElementMenu = useAddElementStore(state => state.setShowAddElementMenu);
    const isEditingCode = useCodeEditorStore(state => state.isEditing);

    const handleKeyDown: KeyboardEventHandler<HTMLDivElement> = event => {
        if (!excalidrawApi) return;

        logger.debug(excalidrawApi.getSceneElements());
        logger.debug(excalidrawApi.getAppState());
        logger.debug(excalidrawApi.getFiles());

        const state = excalidrawApi.getAppState();
        const elements = excalidrawApi.getSceneElements();

        if (event.key === "Meta") {
            setShowVisualElements(false);
            setMetaKeyIsDown(true);
        }

        const isEditingText = state.editingElement?.type === "text";
        const addElementKeybindingPressed =
            event.key === NativeToolbarAddElementButton.getKeybinding();

        if (addElementKeybindingPressed && !isEditingText && !isEditingCode) {
            // do not send key event to new menu input
            setTimeout(() => {
                setShowAddElementMenu(true);
            }, 100);
            return;
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
            const selected = ElementUtil.getSelectedElements(state, elements);

            if (CustomDataUtil.isModelElements(selected)) {
                // do not allow extensions on model elements
                return;
            }

            const result = ElementVisualUtils.createElementExtensionShadow(
                event.key,
                excalidrawApi,
                shadowElements
            );

            setShadowElements(result);
        }
    };

    const handleKeyUp: KeyboardEventHandler<HTMLDivElement> = event => {
        if (!excalidrawApi) return;

        if (event.key === "Meta") {
            setShowVisualElements(true);
            setMetaKeyIsDown(false);
        }

        // finalize arrow creation
        if (shadowElements && event.key === "Meta") {
            ElementVisualUtils.createElementExtensionFromShadow(shadowElements, excalidrawApi);
            setShadowElements(undefined);
        }
    };

    return {
        handleKeyDown,
        handleKeyUp,
    };
};
