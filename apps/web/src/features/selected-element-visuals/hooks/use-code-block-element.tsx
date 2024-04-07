import { useGlobal } from "@/contexts/global-context";
import { OnChangeCallback } from "@/features/draw/draw";
import { CustomDataUtil } from "@/features/draw/utils/custom-data-util";
import { ElementPositionUtil } from "@/features/draw/utils/element-position-util";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { UpdateElementUtil } from "@/features/draw/utils/update-element-util";
import { Maybe, debounce, isEqual } from "@banjoanton/utils";
import Editor, { Monaco } from "@monaco-editor/react";
import { CustomData, CustomDataCodeblock, ExcalidrawElement } from "common";
import { useRef, useState } from "react";

type CodeBlockStyle = {
    left: string;
    top: string;
    width: string;
    height: string;
};

type CodeBlockElement = {
    style: CodeBlockStyle;
    element: ExcalidrawElement;
};

const CodeEditor = ({ element, style }: CodeBlockElement) => {
    const editorRef = useRef(null);

    const handleEditorDidMount = (editor: any, monaco: Monaco) => {
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

    return (
        <div className="absolute z-[3] rounded-md" style={style}>
            <Editor
                className="p-2 bg-[#1e1e1e]"
                defaultLanguage="javascript"
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

export const useCodeBlockElement = () => {
    const { excalidrawApi } = useGlobal();
    const [codeBlockElements, setCodeBlockElements] = useState<CodeBlockElement[]>([]);

    const updateCodeBlockElements: OnChangeCallback = (elements, appState) => {
        if (!excalidrawApi) return;
        const codeElements = elements.filter(CustomDataUtil.isCodeBlockElement);

        const newCodeBlockElements: CodeBlockElement[] = codeElements.map(element => {
            const windowPosition = ElementPositionUtil.getElementWindowPosition(element, appState);

            const style = {
                left: `${windowPosition.x}px`,
                top: `${windowPosition.y}px`,
                width: `${element.width}px`,
                height: `${element.height}px`,
            };

            return {
                element,
                style,
            };
        });

        if (!isEqual(newCodeBlockElements, codeBlockElements)) {
            setCodeBlockElements(newCodeBlockElements);
        }

        const selected = ElementUtil.getSelectedElements(appState, codeElements);

        // hide app menu when code block is selected
        const appMenu = document.querySelector(".App-menu__left");
        if (selected.length === 1) {
            if (appMenu) {
                appMenu.setAttribute("style", "display: none");
            }
        } else {
            if (appMenu) {
                appMenu.setAttribute("style", "display: block");
            }
        }
    };

    const render = () => {
        if (!excalidrawApi) return null;

        return (
            <>
                {codeBlockElements.map(({ element, style }) => {
                    return (
                        <CodeEditor
                            key={"code-block" + element.id}
                            style={style}
                            element={element}
                        />
                    );
                })}
            </>
        );
    };

    return {
        render,
        updateCodeBlockElements,
    };
};
