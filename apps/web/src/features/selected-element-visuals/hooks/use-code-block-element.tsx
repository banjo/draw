import { useGlobal } from "@/contexts/global-context";
import { OnChangeCallback } from "@/features/draw/draw";
import { NativeAppMenuLeft } from "@/features/draw/models/native/native-app-menu-left";
import { NativeToolbar } from "@/features/draw/models/native/native-toolbar";
import { CustomDataUtil } from "@/features/draw/utils/custom-data-util";
import { ElementPositionUtil } from "@/features/draw/utils/element-position-util";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { CodeEditorMenuContainer } from "@/features/selected-element-visuals/components/code-editor-menu";
import { first, isEqual, Maybe } from "@banjoanton/utils";
import { ExcalidrawElement } from "common";
import { lazy, Suspense, useMemo } from "react";
import { createStore, StoreApi, useStore } from "zustand";

// Loaded once a drawing has a code block, as the editor and its highlighting are large
const CodeEditor = lazy(() =>
    import("@/features/selected-element-visuals/components/code-editor").then(m => ({
        default: m.CodeEditor,
    }))
);

type CodeBlockStyle = {
    left: string;
    top: string;
    width: string;
    height: string;
};

export type CodeBlockElement = {
    style: CodeBlockStyle;
    element: ExcalidrawElement;
};

type CodeBlockState = {
    codeBlockElements: CodeBlockElement[];
    selectedElement: Maybe<ExcalidrawElement>;
};

/** The code blocks on their own, so moving them doesn't re-render the whole drawing */
const CodeBlocks = ({ store }: { store: StoreApi<CodeBlockState> }) => {
    const codeBlockElements = useStore(store, state => state.codeBlockElements);
    const selectedElement = useStore(store, state => state.selectedElement);

    return (
        <>
            {codeBlockElements.length > 0 ? (
                <Suspense fallback={null}>
                    {codeBlockElements.map(({ element, style }) => (
                        <CodeEditor
                            key={`code-block${element.id}`}
                            style={style}
                            element={element}
                        />
                    ))}
                </Suspense>
            ) : null}
            {selectedElement ? <CodeEditorMenuContainer element={selectedElement} /> : null}
        </>
    );
};

export const useCodeBlockElement = () => {
    const { excalidrawApi } = useGlobal();
    // One store per drawing, as the drawing remounts for each slug
    const store = useMemo(
        () =>
            createStore<CodeBlockState>(() => ({
                codeBlockElements: [],
                selectedElement: undefined,
            })),
        []
    );

    const updateCodeBlockElements: OnChangeCallback = (elements, appState) => {
        if (!excalidrawApi) return;
        const codeElements = elements.filter(CustomDataUtil.isCodeBlockElement);

        const newCodeBlockElements: CodeBlockElement[] = codeElements.map(element => {
            const windowPosition = ElementPositionUtil.getElementWindowPosition(element, appState);
            const zoom = appState.zoom.value;

            const style = {
                left: `${windowPosition.x}px`,
                top: `${windowPosition.y}px`,
                width: `${element.width * zoom}px`,
                height: `${element.height * zoom}px`,
            };

            return {
                element,
                style,
            };
        });

        if (!isEqual(newCodeBlockElements, store.getState().codeBlockElements)) {
            store.setState({ codeBlockElements: newCodeBlockElements });
        }

        const selectedElements = ElementUtil.getSelectedElements(appState, codeElements);
        const selected = first(selectedElements);

        NativeAppMenuLeft.parse();
        if (selected) {
            store.setState({ selectedElement: selected });
            NativeAppMenuLeft.hide();
            NativeToolbar.hideEditButton();
        } else {
            store.setState({ selectedElement: undefined });
            NativeAppMenuLeft.show();
            NativeToolbar.showEditButton();
        }
    };

    const codeBlocks = useMemo(
        () => (excalidrawApi ? <CodeBlocks store={store} /> : null),
        [excalidrawApi, store]
    );

    return {
        codeBlocks,
        updateCodeBlockElements,
    };
};
