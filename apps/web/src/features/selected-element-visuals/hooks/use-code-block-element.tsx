import { useGlobal } from "@/contexts/global-context";
import { OnChangeCallback } from "@/features/draw/draw";
import { NativeAppMenuLeft } from "@/features/draw/models/native/native-app-menu-left";
import { NativeMobileBottomToolbar } from "@/features/draw/models/native/native-mobile-bottom-toolbar";
import { CustomDataUtil } from "@/features/draw/utils/custom-data-util";
import { ElementPositionUtil } from "@/features/draw/utils/element-position-util";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { CodeEditor } from "@/features/selected-element-visuals/components/code-editor";
import { isEqual } from "@banjoanton/utils";
import { ExcalidrawElement } from "common";
import { useState } from "react";

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

        if (selected.length > 0) {
            NativeAppMenuLeft().hide();
            NativeMobileBottomToolbar().hide();
        } else {
            NativeAppMenuLeft().show();
            NativeMobileBottomToolbar().show();
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
