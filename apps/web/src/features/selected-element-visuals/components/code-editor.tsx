import { useGlobal } from "@/contexts/global-context";
import { CUSTOM_ELEMENT_CLASS } from "@/features/draw/models/constants";
import { NativeContainer } from "@/features/draw/models/native/native-container";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { UpdateElementUtil } from "@/features/draw/utils/update-element-util";
import { CodeBlockElement } from "@/features/selected-element-visuals/hooks/use-code-block-element";
import { CODE_EDITOR_LANGUAGES } from "@/features/selected-element-visuals/models/code-editor-langauges";
import { useCodeEditorStore } from "@/features/selected-element-visuals/stores/use-code-editor-store";
import { Maybe, debounce, includes } from "@banjoanton/utils";
import { Editor, Monaco } from "@monaco-editor/react";
import { CustomData, CustomDataCodeblock } from "common";
import { editor } from "monaco-editor/esm/vs/editor/editor.api";
import { useEffect, useRef } from "react";
import "./code-editor.css";

export const CODE_ELEMENT_CLASS = "code-element";

export const CodeEditor = ({ element, style }: CodeBlockElement) => {
    const { excalidrawApi } = useGlobal();
    const getSelectedLanguage = useCodeEditorStore(state => state.getSelectedLanguage);
    const setSelectedLanguage = useCodeEditorStore(state => state.setSelectedLanguage);
    const setFontSize = useCodeEditorStore(state => state.setFontSize);
    const fontSize = useCodeEditorStore(state => state.fontSize);
    const editorRef = useRef<editor.ICodeEditor>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleEditorDidMount = (editor: editor.ICodeEditor, monaco: Monaco) => {
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
        if (
            customData.language &&
            includes(CODE_EDITOR_LANGUAGES, customData.language) &&
            element.id
        ) {
            setSelectedLanguage(element.id, customData.language);
        }

        if (customData.fontSize) {
            setFontSize(customData.fontSize);
        }
    }, []);

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
            NativeContainer.parse();
            NativeContainer.focus();
        }
    };

    const zoom = excalidrawApi?.getAppState().zoom.value ?? 1;

    return (
        <div
            className={`absolute z-[3] rounded-lg cursor-move overflow-hidden ${CODE_ELEMENT_CLASS} ${CUSTOM_ELEMENT_CLASS}`}
            data-element-id={element.id}
            style={style}
            ref={containerRef}
            onKeyDown={handleKeyDown}
        >
            <Editor
                className="p-2 bg-[#1e1e1e] cursor-move"
                defaultLanguage={getSelectedLanguage(element.id).toLowerCase()}
                language={getSelectedLanguage(element.id).toLowerCase()}
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
                    readOnly: false,
                    quickSuggestions: false,
                    suggestOnTriggerCharacters: false,
                    matchBrackets: "never",
                    renderWhitespace: "none",
                    automaticLayout: true,
                    contextmenu: false,
                    wordWrap: "on",
                    fontSize: fontSize * zoom,
                }}
                theme="vs-dark"
            />
        </div>
    );
};
