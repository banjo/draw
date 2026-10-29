import { useGlobal } from "@/contexts/global-context";
import { ElementUtil } from "@/features/draw/utils/element-util";
import {
    ElementExtensionShadow,
    ElementVisualUtils,
} from "@/features/draw/utils/element-visual-utils";
import { useMermaidDialogStore } from "@/features/mermaid/stores/use-mermaid-dialog-store";
import { useCodeEditorStore } from "@/features/selected-element-visuals/stores/use-code-editor-store";
import { useAddElementStore } from "@/stores/use-add-element-store";
import { useVisualElementStore } from "@/stores/use-visual-element-store";
import { Callback, includes, Maybe } from "@banjoanton/utils";
import { ExcalidrawApi } from "common";
import React, { KeyboardEventHandler, useEffect, useRef, useState } from "react";
import { NativeToolbarAddElementButton } from "../../models/native/native-toolbar-add-element-button";
import { CustomDataUtil } from "../../utils/custom-data-util";
import { IS_MAC } from "@/utils/platform";

type In = {
    handleChangeElementDialogClick: Callback;
};

export const ARROW_KEYS = ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"] as const;
export type ArrowKey = (typeof ARROW_KEYS)[number];

// ⌘ on macOS, Ctrl elsewhere, like Excalidraw's own shortcuts
const MODIFIER_KEY = IS_MAC ? "Meta" : "Control";
const isModifierPressed = (event: { metaKey: boolean; ctrlKey: boolean }) =>
    IS_MAC ? event.metaKey : event.ctrlKey;

/** Typing in the code editor, a rename field, or another input */
export const isTypingTarget = (target: EventTarget | null) =>
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

export const useKeyboard = ({ handleChangeElementDialogClick }: In) => {
    const { excalidrawApi } = useGlobal();
    const [shadowElements, setShadowElements] = useState<Maybe<ElementExtensionShadow>>(undefined);
    const setShowVisualElements = useVisualElementStore(state => state.setShowVisualElements);
    const setMetaKeyIsDown = useVisualElementStore(state => state.setMetaKeyIsDown);
    const openAddElementMenu = useAddElementStore(state => state.open);
    const isEditingCode = useCodeEditorStore(state => state.editingElementId !== undefined);
    const setEditingCodeBlockId = useCodeEditorStore(state => state.setEditingElementId);

    // The latest shadow, for the blur listener
    const shadowRef = useRef(shadowElements);
    shadowRef.current = shadowElements;

    const isTyping = (event: React.KeyboardEvent, api: ExcalidrawApi) =>
        Boolean(api.getAppState().editingTextElement) ||
        isEditingCode ||
        isTypingTarget(event.target);

    /** Enter edits a selected code block, like text, or Mermaid block, instead of cropping */
    const openSelectedCodeBlock = (event: React.KeyboardEvent, api: ExcalidrawApi) => {
        const selected = ElementUtil.getSelectedElements(api.getAppState(), api.getSceneElements());
        const block = selected.length === 1 ? selected[0] : undefined;
        if (!block) return;

        if (CustomDataUtil.isMermaidElement(block)) {
            event.preventDefault();
            event.stopPropagation();
            useMermaidDialogStore.getState().open({ kind: "edit", id: block.id });
            return;
        }

        if (!CustomDataUtil.isCodeBlockElement(block)) return;

        event.preventDefault();
        event.stopPropagation();
        setEditingCodeBlockId(block.id);
    };

    /**
     * ⌘/Ctrl+arrow shows where the selection would extend to. Handled before Excalidraw sees
     * the key, as its own version (flowcharts) would add a second shape.
     */
    const handleKeyDownCapture: KeyboardEventHandler<HTMLDivElement> = event => {
        if (!excalidrawApi || isTyping(event, excalidrawApi)) return;

        if (event.key === "Enter" && !isModifierPressed(event) && !event.shiftKey) {
            openSelectedCodeBlock(event, excalidrawApi);
            return;
        }

        if (!isModifierPressed(event) || !includes(ARROW_KEYS, event.key)) return;

        event.preventDefault();
        event.stopPropagation();

        const state = excalidrawApi.getAppState();
        const selected = ElementUtil.getSelectedElements(state, excalidrawApi.getSceneElements());
        // do not allow extensions on model elements, frames and swimlanes
        if (CustomDataUtil.isModelElements(selected)) return;
        if (!selected.every(CustomDataUtil.hasShapeActions)) return;

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
                openAddElementMenu("pointer");
            }, 100);
            return;
        }

        // If one element selected, allow change element type
        const isChangeable =
            ElementUtil.getSelectedElementIds(state).length === 1 &&
            ElementUtil.getSelectedElements(state, excalidrawApi.getSceneElements()).every(
                CustomDataUtil.hasShapeActions
            );
        if (isChangeable && event.key === "Tab") {
            // Or the browser moves the focus on, out of the dialog that just opened
            event.preventDefault();
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

            ElementVisualUtils.removeElementExtensionShadow(shadow, excalidrawApi);
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
