import { useGlobal } from "@/contexts/global-context";
import { OnChangeCallback } from "@/features/draw/draw";
import { CustomDataUtil } from "@/features/draw/utils/custom-data-util";
import { ElementPositionUtil } from "@/features/draw/utils/element-position-util";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { isEqual } from "@banjoanton/utils";
import { CustomDataCodeblock, ExcalidrawElement } from "common";
import { useState } from "react";

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
                    // lazy cast
                    const data = element.customData as CustomDataCodeblock;

                    return (
                        <div
                            key={"code-block" + element.id}
                            style={style}
                            className="absolute z-[3] pointer-events-none bg-green-100"
                        >
                            {data.code}
                        </div>
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
