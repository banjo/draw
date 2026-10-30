import { useGlobal } from "@/contexts/global-context";
import { OnChangeCallback } from "@/features/draw/draw";
import { NativeContainer } from "@/features/draw/models/native/native-container";
import { CustomDataUtil } from "@/features/draw/utils/custom-data-util";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { viewportCoordsToSceneCoords } from "@excalidraw/excalidraw";
import { CustomData, ExcalidrawElement } from "common";
import React from "react";
import { MermaidDialog } from "../components/mermaid-dialog";
import { MermaidMenuContainer } from "../components/mermaid-menu";
import { useMermaidDialogStore } from "../stores/use-mermaid-dialog-store";

const MERMAID_SELECTED_CLASS = "mermaid-block-selected";

const isLiveMermaidBlock = (element: ExcalidrawElement) =>
    CustomDataUtil.isMermaidElement(element) && !element.isDeleted;

/** The Mermaid dialog, and editing Mermaid blocks with a double-click */
export const useMermaid = () => {
    const { excalidrawApi } = useGlobal();
    const target = useMermaidDialogStore(state => state.target);

    const close = () => {
        useMermaidDialogStore.getState().close();
        NativeContainer.parse();
        NativeContainer.focus();
    };

    /** The selected block's settings. Excalidraw's hint is about cropping, which it isn't for. */
    const updateMermaidBlocks: OnChangeCallback = (elements, appState) => {
        const selection = ElementUtil.getSelectedElements(appState, elements);
        const [block] = selection;
        const isBlockSelected = selection.length === 1 && block && isLiveMermaidBlock(block);
        document.body.classList.toggle(MERMAID_SELECTED_CLASS, Boolean(isBlockSelected));

        const store = useMermaidDialogStore.getState();
        const definition = block && CustomData.getMermaidDefinition(block.customData);
        const next =
            isBlockSelected && definition !== undefined ? { id: block.id, definition } : undefined;
        if (JSON.stringify(next) !== JSON.stringify(store.selected)) store.setSelected(next);
    };

    /** Double-clicking a block changes its diagram, instead of cropping the image */
    const onDoubleClickCapture = (event: React.MouseEvent) => {
        if (!excalidrawApi || !(event.target instanceof HTMLCanvasElement)) return;

        const { x, y } = viewportCoordsToSceneCoords(event, excalidrawApi.getAppState());
        const hit = excalidrawApi
            .getSceneElements()
            .filter(isLiveMermaidBlock)
            .findLast(e => x >= e.x && x <= e.x + e.width && y >= e.y && y <= e.y + e.height);
        if (!hit) return;

        event.preventDefault();
        event.stopPropagation();
        useMermaidDialogStore.getState().open({ kind: "edit", id: hit.id });
    };

    const render = () => (
        <>
            {excalidrawApi && target ? <MermaidDialog target={target} onClose={close} /> : null}
            {excalidrawApi ? <MermaidMenuContainer /> : null}
        </>
    );

    return { render, updateMermaidBlocks, onDoubleClickCapture };
};
