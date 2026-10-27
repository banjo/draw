import { useGlobal } from "@/contexts/global-context";
import { CODE_ELEMENT_CLASS, CUSTOM_ELEMENT_CLASS } from "@/features/draw/models/constants";
import { NativeContainer } from "@/features/draw/models/native/native-container";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { UpdateElementUtil } from "@/features/draw/utils/update-element-util";
import { CodeBlockElement } from "@/features/selected-element-visuals/hooks/use-code-block-element";
import { getCodeBlockSettings } from "@/features/selected-element-visuals/models/code-editor-langauges";
import { useCodeEditorStore } from "@/features/selected-element-visuals/stores/use-code-editor-store";
import { cn } from "@/lib/utils";
import { debounce, Maybe } from "@banjoanton/utils";
import {
    codeHighlightPlugins,
    toPrismLanguage,
} from "@/features/selected-element-visuals/models/code-highlighting";
import Editor from "@uiw/react-textarea-code-editor/nohighlight";
import { CustomData, CustomDataCodeblock } from "common";
import { useEffect, useMemo, useRef } from "react";
import "./code-editor.css";
import React from "react";

const SCENE_UPDATE_DELAY = 300;

export const CodeEditor = ({ element, style }: CodeBlockElement) => {
    const { excalidrawApi } = useGlobal();
    const editorRef = useRef<HTMLTextAreaElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const setEditingElementId = useCodeEditorStore(state => state.setEditingElementId);

    // Tell Excalidraw about the change, so it's saved and sent to collaborators
    const updateScene = useMemo(
        () =>
            debounce(() => {
                if (!excalidrawApi) return;
                excalidrawApi.updateScene({
                    elements: excalidrawApi.getSceneElementsIncludingDeleted(),
                });
            }, SCENE_UPDATE_DELAY),
        [excalidrawApi]
    );

    const onChange = (value: Maybe<string>) => {
        // Change the scene's copy, as a remote update may have replaced it since this rendered
        const current =
            excalidrawApi?.getSceneElementsIncludingDeleted().find(e => e.id === element.id) ??
            element;

        UpdateElementUtil.mutateElement(current, draft => {
            draft.customData = CustomData.updateCodeblock(draft.customData, {
                code: value,
            });
        });
        updateScene();
    };

    const customData = element.customData as CustomDataCodeblock;
    const { language, fontSize } = getCodeBlockSettings(element.customData);

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
                    language={toPrismLanguage(language)}
                    rehypePlugins={codeHighlightPlugins}
                    data-color-mode="dark"
                    padding={0}
                    onFocus={() => setEditingElementId(element.id)}
                    onBlur={() => setEditingElementId(undefined)}
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
