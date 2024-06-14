import { useGlobal } from "@/contexts/global-context";
import { CUSTOM_ELEMENT_CLASS } from "@/features/draw/models/constants";
import { NativeContainer } from "@/features/draw/models/native/native-container";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { UpdateElementUtil } from "@/features/draw/utils/update-element-util";
import { CodeBlockElement } from "@/features/selected-element-visuals/hooks/use-code-block-element";
import { CODE_EDITOR_LANGUAGES } from "@/features/selected-element-visuals/models/code-editor-langauges";
import { useCodeEditorStore } from "@/features/selected-element-visuals/stores/use-code-editor-store";
import { Maybe, debounce, includes } from "@banjoanton/utils";
import { CustomData, CustomDataCodeblock } from "common";
import { useEffect, useRef } from "react";
import "./code-editor.css";
import { cn } from "@/lib/utils";
import Editor from "@uiw/react-textarea-code-editor";

export const CODE_ELEMENT_CLASS = "code-element";

export const CodeEditor = ({ element, style }: CodeBlockElement) => {
    const { excalidrawApi } = useGlobal();
    const getSelectedLanguage = useCodeEditorStore(state => state.getSelectedLanguage);
    const setSelectedLanguage = useCodeEditorStore(state => state.setSelectedLanguage);
    const setFontSize = useCodeEditorStore(state => state.setFontSize);
    const fontSize = useCodeEditorStore(state => state.fontSize);
    const editorRef = useRef<HTMLTextAreaElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const onChange = async (value: Maybe<string>) => {
        UpdateElementUtil.mutateElement(element, element => {
            element.customData = CustomData.updateCodeblock(element.customData, {
                code: value,
            });
        });
    };

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
            editorRef.current?.blur();
            NativeContainer.parse();
            NativeContainer.focus();
        }
    };

    const zoom = excalidrawApi?.getAppState().zoom.value ?? 1;
    const fontSizeWithZoom = fontSize * zoom;
    const selectedLanguage = getSelectedLanguage(element.id);

    return (
        <div
            className={cn(
                `absolute z-[3] rounded-md cursor-move overflow-hidden ${CODE_ELEMENT_CLASS} ${CUSTOM_ELEMENT_CLASS}`
            )}
            data-element-id={element.id}
            style={style}
            ref={containerRef}
            onKeyDown={handleKeyDown}
        >
            <div className="p-[2%] bg-[#161B22] w-full h-full">
                <Editor
                    ref={editorRef}
                    value={customData.code}
                    className="w-full h-full"
                    language={selectedLanguage.toLowerCase()}
                    data-color-mode="dark"
                    padding={0}
                    onChange={evn => onChange(evn.target.value)}
                    style={{
                        fontSize: fontSizeWithZoom,
                        fontFamily:
                            "ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace",
                    }}
                />
            </div>
        </div>
    );
};
