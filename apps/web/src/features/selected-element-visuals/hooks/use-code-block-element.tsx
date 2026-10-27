import { useGlobal } from "@/contexts/global-context";
import { OnChangeCallback } from "@/features/draw/draw";
import { NativeAppMenuLeft } from "@/features/draw/models/native/native-app-menu-left";
import { NativeToolbar } from "@/features/draw/models/native/native-toolbar";
import { CodeBlockUtil } from "@/features/draw/utils/code-block-util";
import { CustomDataUtil } from "@/features/draw/utils/custom-data-util";
import { ElementPositionUtil } from "@/features/draw/utils/element-position-util";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { CodeEditorMenuContainer } from "@/features/selected-element-visuals/components/code-editor-menu";
import { CodeBlockImage } from "@/features/selected-element-visuals/models/code-block-image";
import { useCodeEditorStore } from "@/features/selected-element-visuals/stores/use-code-editor-store";
import { useLatestCallback } from "@/hooks/use-latest-callback";
import { first, isEqual, Maybe } from "@banjoanton/utils";
import { CaptureUpdateAction, viewportCoordsToSceneCoords } from "@excalidraw/excalidraw";
import { AppState } from "@excalidraw/excalidraw/types";
import { ExcalidrawElement } from "common";
import React, { lazy, Suspense, useEffect, useMemo } from "react";
import { createStore, StoreApi, useStore } from "zustand";

// Loaded when a code block is first edited, as the editor and its highlighting are large
const CodeEditor = lazy(() =>
    import("@/features/selected-element-visuals/components/code-editor").then(m => ({
        default: m.CodeEditor,
    }))
);

/** Where the editor goes, in pixels on the screen */
export type CodeEditorLayout = {
    left: number;
    top: number;
    width: number;
    height: number;
    fontSize: number;
    padding: number;
    radius: number;
    theme: AppState["theme"];
};

type CodeBlockState = {
    editing: Maybe<{ element: ExcalidrawElement; layout: CodeEditorLayout }>;
    selectedElement: Maybe<ExcalidrawElement>;
};

const getLayout = (element: ExcalidrawElement, appState: AppState): CodeEditorLayout => {
    const { x, y } = ElementPositionUtil.getElementWindowPosition(element, appState);
    const content = CodeBlockImage.getContent(element);
    const naturalWidth = CodeBlockImage.getNaturalSize(content).width;
    // The image's size relative to its font size, times the zoom
    const scale = (element.width / naturalWidth) * appState.zoom.value;
    const { padding } = CodeBlockImage.getMetrics(content.fontSize);

    return {
        left: x,
        top: y,
        width: element.width * appState.zoom.value,
        height: element.height * appState.zoom.value,
        fontSize: content.fontSize * scale,
        padding: padding * scale,
        radius: content.fontSize * 0.5 * scale,
        theme: appState.theme,
    };
};

/** The editor and the code block menu, on their own so they don't re-render the drawing */
const CodeBlocks = ({ store }: { store: StoreApi<CodeBlockState> }) => {
    const editing = useStore(store, state => state.editing);
    const selectedElement = useStore(store, state => state.selectedElement);

    return (
        <>
            {editing ? (
                <Suspense fallback={null}>
                    <CodeEditor
                        key={editing.element.id}
                        element={editing.element}
                        layout={editing.layout}
                    />
                </Suspense>
            ) : null}
            {selectedElement ? <CodeEditorMenuContainer element={selectedElement} /> : null}
        </>
    );
};

const CODE_BLOCK_SELECTED_CLASS = "code-block-selected";

const isLiveCodeBlock = (element: ExcalidrawElement) =>
    CustomDataUtil.isCodeBlockElement(element) && !element.isDeleted;

export const useCodeBlockElement = () => {
    const { excalidrawApi } = useGlobal();
    // One store per drawing, as the drawing remounts for each slug
    const store = useMemo(
        () =>
            createStore<CodeBlockState>(() => ({
                editing: undefined,
                selectedElement: undefined,
            })),
        []
    );

    const updateEditorAndMenu = useLatestCallback(
        (codeElements: ExcalidrawElement[], appState: AppState) => {
            const { editingElementId, setEditingElementId } = useCodeEditorStore.getState();
            const editingElement = codeElements.find(element => element.id === editingElementId);

            // Removed while it was being edited, e.g. by someone else
            if (editingElementId && !editingElement) {
                setEditingElementId(undefined);
            }

            const editing = editingElement
                ? { element: editingElement, layout: getLayout(editingElement, appState) }
                : undefined;
            if (!isEqual(editing, store.getState().editing)) {
                store.setState({ editing });
            }

            const selected = first(ElementUtil.getSelectedElements(appState, codeElements));
            if (selected !== store.getState().selectedElement) {
                store.setState({ selectedElement: selected });
            }

            // Excalidraw's hint says double-click or Enter crops the image
            document.body.classList.toggle(CODE_BLOCK_SELECTED_CLASS, Boolean(selected));

            NativeAppMenuLeft.parse();
            if (selected) {
                NativeAppMenuLeft.hide();
                NativeToolbar.hideEditButton();
            } else {
                NativeAppMenuLeft.show();
                NativeToolbar.showEditButton();
            }
        }
    );

    const updateCodeBlockElements: OnChangeCallback = (elements, appState) => {
        if (!excalidrawApi) return;
        const codeElements = elements.filter(isLiveCodeBlock);

        // Old code blocks become images once. Everyone converts them the same way.
        const legacyIds = new Set(codeElements.filter(CodeBlockUtil.isLegacy).map(e => e.id));
        if (legacyIds.size > 0) {
            excalidrawApi.updateScene({
                elements: excalidrawApi
                    .getSceneElementsIncludingDeleted()
                    .map(e => (legacyIds.has(e.id) ? CodeBlockUtil.fromLegacy(e) : e)),
                captureUpdate: CaptureUpdateAction.NEVER,
            });
            return;
        }

        // The images aren't saved, as every browser can make them from the code
        const files = excalidrawApi.getFiles();
        const missing = codeElements.filter(element => {
            const fileId = CodeBlockUtil.getFileId(element);
            return fileId && !files[fileId];
        });
        if (missing.length > 0) {
            excalidrawApi.addFiles(
                missing.map(element =>
                    CodeBlockImage.createFile({
                        ...element,
                        fileId: CodeBlockUtil.getFileId(element),
                    })
                )
            );
        }

        updateEditorAndMenu(codeElements, appState);
    };

    // Show the editor as soon as it's opened, not on the next change
    useEffect(() => {
        if (!excalidrawApi) return;
        return useCodeEditorStore.subscribe((state, previous) => {
            if (state.editingElementId === previous.editingElementId) return;

            // The block being edited is the selected one
            const editingId = state.editingElementId;
            if (editingId && !excalidrawApi.getAppState().selectedElementIds[editingId]) {
                const element = excalidrawApi.getSceneElements().find(e => e.id === editingId);
                if (element) {
                    const { updatedState } = ElementUtil.createNewElementSelection(
                        [element],
                        excalidrawApi.getAppState()
                    );
                    excalidrawApi.updateScene({ appState: updatedState });
                }
            }

            updateEditorAndMenu(
                excalidrawApi.getSceneElements().filter(isLiveCodeBlock),
                excalidrawApi.getAppState()
            );
        });
    }, [excalidrawApi, updateEditorAndMenu]);

    /** Double-clicking a code block edits its code, instead of cropping the image */
    const onDoubleClickCapture = (event: React.MouseEvent) => {
        if (!excalidrawApi || !(event.target instanceof HTMLCanvasElement)) return;

        const { x, y } = viewportCoordsToSceneCoords(event, excalidrawApi.getAppState());
        const hit = excalidrawApi
            .getSceneElements()
            .filter(isLiveCodeBlock)
            .findLast(e => x >= e.x && x <= e.x + e.width && y >= e.y && y <= e.y + e.height);
        if (!hit) return;

        event.preventDefault();
        event.stopPropagation();
        useCodeEditorStore.getState().setEditingElementId(hit.id);
    };

    const codeBlocks = useMemo(
        () => (excalidrawApi ? <CodeBlocks store={store} /> : null),
        [excalidrawApi, store]
    );

    return {
        codeBlocks,
        updateCodeBlockElements,
        onDoubleClickCapture,
    };
};
