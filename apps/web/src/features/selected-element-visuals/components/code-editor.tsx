import { useGlobal } from "@/contexts/global-context";
import { NativeContainer } from "@/features/draw/models/native/native-container";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { UpdateElementUtil } from "@/features/draw/utils/update-element-util";
import { CodeBlockElement } from "@/features/selected-element-visuals/hooks/use-code-block-element";
import { DEFAULT_CODE_EDITOR_LANGUAGE } from "@/features/selected-element-visuals/models/code-editor-langauges";
import { useCodeEditorStore } from "@/features/selected-element-visuals/stores/use-code-editor-store";
import { Maybe, debounce } from "@banjoanton/utils";
import { Editor, Monaco } from "@monaco-editor/react";
import { CustomData, CustomDataCodeblock } from "common";
import { editor } from "monaco-editor/esm/vs/editor/editor.api";
import { useEffect, useRef } from "react";

export const CodeEditor = ({ element, style }: CodeBlockElement) => {
    const { excalidrawApi } = useGlobal();
    const selectedLanguage = useCodeEditorStore(state => state.selectedLanguage);
    const editorRef = useRef<editor.ICodeEditor>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleEditorDidMount = (editor: editor.ICodeEditor, monaco: Monaco) => {
        // TODO: is this correct type?
        // @ts-ignore
        editorRef.current = editor;
    };

    const onChange = async (value: Maybe<string>) => {
        UpdateElementUtil.mutateElement(element, (element, helpers) => {
            element.customData = CustomData.updateCodeblock(element.customData, {
                code: value,
            });
        });
    };

    const debouncedOnChange = debounce(onChange, 500);
    const customData = element.customData as CustomDataCodeblock;

    useEffect(() => {
        const container = containerRef.current;

        const handleClick = () => {
            if (!excalidrawApi) return;
            const state = excalidrawApi.getAppState();

            const { updatedState } = ElementUtil.createNewElementSelection([element], state);

            excalidrawApi.updateScene({
                appState: updatedState,
            });
        };

        if (container) {
            container.addEventListener("click", handleClick);
        }
    }, []);

    const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = event => {
        if (event.key === "Escape") {
            if (!excalidrawApi) return;
            editorRef.current?.getDomNode()?.blur();
            NativeContainer().focus();
        }
    };

    return (
        <div
            className="absolute z-[3] rounded-md cursor-move"
            style={style}
            ref={containerRef}
            onKeyDown={handleKeyDown}
        >
            <Editor
                className="p-2 bg-[#1e1e1e] cursor-move"
                defaultLanguage={DEFAULT_CODE_EDITOR_LANGUAGE.toLowerCase()}
                language={selectedLanguage.toLowerCase()}
                defaultValue={customData.code}
                onChange={debouncedOnChange}
                onMount={handleEditorDidMount}
                options={{
                    lineNumbers: "off",
                    minimap: { enabled: false },
                    glyphMargin: false,
                    folding: false,
                    scrollbar: { vertical: "hidden", horizontal: "hidden" },
                    scrollBeyondLastLine: false,
                    lineDecorationsWidth: 0,
                    renderLineHighlight: "none",
                    overviewRulerLanes: 0,
                }}
                theme="vs-dark"
            />
        </div>
    );
};
