import { useGlobal } from "@/contexts/global-context";
import { ElementUtil } from "@/features/draw/utils/element-util";
import {
    ElementExtensionShadow,
    ElementVisualUtils,
} from "@/features/draw/utils/element-visual-utils";
import { useCodeEditorStore } from "@/features/selected-element-visuals/stores/use-code-editor-store";
import { useAddElementStore } from "@/stores/use-add-element-store";
import { useVisualElementStore } from "@/stores/use-visual-element-store";
import { UpdateElementUtil } from "@/features/draw/utils/update-element-util";
import { Callback, includes, Maybe } from "@banjoanton/utils";
import { ExcalidrawApi } from "common";
import React, { KeyboardEventHandler, useEffect, useRef, useState } from "react";
import { NativeToolbarAddElementButton } from "../../models/native/native-toolbar-add-element-button";
import { CustomDataUtil } from "../../utils/custom-data-util";

type In = {
    handleChangeElementDialogClick: Callback;
};

export const ARROW_KEYS = ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"] as const;
export type ArrowKey = (typeof ARROW_KEYS)[number];

const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform);
// ⌘ on macOS, Ctrl elsewhere, like Excalidraw's own shortcuts
const MODIFIER_KEY = IS_MAC ? "Meta" : "Control";
const isModifierPressed = (event: { metaKey: boolean; ctrlKey: boolean }) =>
    IS_MAC ? event.metaKey : event.ctrlKey;

/** Typing in the code editor, a rename field, or another input */
const isTypingTarget = (target: EventTarget) =>
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

export const useKeyboard = ({ handleChangeElementDialogClick }: In) => {
    const { excalidrawApi } = useGlobal();
    const [shadowElements, setShadowElements] = useState<Maybe<ElementExtensionShadow>>(undefined);
    const setShowVisualElements = useVisualElementStore(state => state.setShowVisualElements);
    const setMetaKeyIsDown = useVisualElementStore(state => state.setMetaKeyIsDown);
    const setShowAddElementMenu = useAddElementStore(state => state.setShowAddElementMenu);
    const isEditingCode = useCodeEditorStore(state => state.editingElementId !== undefined);

    // The latest shadow, for the blur listener
    const shadowRef = useRef(shadowElements);
    shadowRef.current = shadowElements;

    const isTyping = (event: React.KeyboardEvent, api: ExcalidrawApi) =>
        Boolean(api.getAppState().editingTextElement) ||
        isEditingCode ||
        isTypingTarget(event.target);

    /**
     * ⌘/Ctrl+arrow shows where the selection would extend to. Handled before Excalidraw sees
     * the key, as its own version (flowcharts) would add a second shape.
     */
    const handleKeyDownCapture: KeyboardEventHandler<HTMLDivElement> = event => {
        if (!excalidrawApi || !isModifierPressed(event) || !includes(ARROW_KEYS, event.key)) return;
        if (isTyping(event, excalidrawApi)) return;

        event.preventDefault();
        event.stopPropagation();

        const state = excalidrawApi.getAppState();
        const selected = ElementUtil.getSelectedElements(state, excalidrawApi.getSceneElements());
        // do not allow extensions on model elements
        if (CustomDataUtil.isModelElements(selected)) return;

        setShadowElements(
            ElementVisualUtils.createElementExtensionShadow(
                event.key,
                excalidrawApi,
                shadowElements
            )
        );
    };

    const handleKeyDown: KeyboardEventHandler<HTMLDivElement> = event => {
        if (!excalidrawApi) return;

        const state = excalidrawApi.getAppState();

        if (event.key === MODIFIER_KEY) {
            setShowVisualElements(false);
            setMetaKeyIsDown(true);
        }

        if (isTyping(event, excalidrawApi)) return;

        // Shift is allowed, as "+" needs it on many keyboards
        const addElementKeybindingPressed =
            event.key === NativeToolbarAddElementButton.getKeybinding() &&
            !event.metaKey &&
            !event.ctrlKey &&
            !event.altKey;

        if (addElementKeybindingPressed) {
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

        // ⌘/Ctrl+Enter copies the selection
        if (isModifierPressed(event) && event.key === "Enter") {
            ElementVisualUtils.smartCopy(excalidrawApi);
        }
    };

    const handleKeyUp: KeyboardEventHandler<HTMLDivElement> = event => {
        if (!excalidrawApi) return;

        if (event.key === MODIFIER_KEY) {
            setShowVisualElements(true);
            setMetaKeyIsDown(false);
        }

        // finalize arrow creation
        if (shadowElements && event.key === MODIFIER_KEY) {
            ElementVisualUtils.createElementExtensionFromShadow(shadowElements, excalidrawApi);
            setShadowElements(undefined);
        }
    };

    // When the window loses focus while the key is held, its keyup never arrives. Reset, and
    // drop the unfinished shadow instead of leaving it on the canvas.
    useEffect(() => {
        const onBlur = () => {
            setMetaKeyIsDown(false);
            setShowVisualElements(true);

            const shadow = shadowRef.current;
            if (!shadow || !excalidrawApi) return;

            const elements = excalidrawApi.getSceneElements();
            const selected = ElementUtil.getSelectedElements(excalidrawApi.getAppState(), elements);
            selected.forEach(element =>
                UpdateElementUtil.mutateElement(element, (draft, helpers) => {
                    helpers.removeBoundElements(draft, [shadow.arrowId]);
                })
            );
            excalidrawApi.updateScene({
                elements: ElementUtil.removeShadowElementsById(elements, shadow),
            });
            setShadowElements(undefined);
        };

        window.addEventListener("blur", onBlur);
        return () => window.removeEventListener("blur", onBlur);
    }, [excalidrawApi, setMetaKeyIsDown, setShowVisualElements]);

    return {
        handleKeyDown,
        handleKeyDownCapture,
        handleKeyUp,
    };
};
