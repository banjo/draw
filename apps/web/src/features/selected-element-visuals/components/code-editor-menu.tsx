import { useGlobal } from "@/contexts/global-context";
import { ExcalidrawUtil } from "@/features/draw/utils/excalidraw-util";
import { UpdateElementUtil } from "@/features/draw/utils/update-element-util";
import {
    CODE_EDITOR_LANGUAGES,
    CodeEditorLanguage,
    getCodeBlockSettings,
} from "@/features/selected-element-visuals/models/code-editor-langauges";
import { parseNumber } from "@banjoanton/utils";
import { CustomData, ExcalidrawElement } from "common";
import { createPortal } from "react-dom";

type Props = {
    element: ExcalidrawElement;
};

export const CUSTOM_CODEBLOCK_MENU_ID = "custom-codeblock-menu";

export const initCodeblockMenuElement = () => {
    ExcalidrawUtil.createCustomNativeElement(
        CUSTOM_CODEBLOCK_MENU_ID,
        ".layer-ui__wrapper footer",
        1
    );
};

const FONT_SIZES = [12, 14, 16, 18, 20, 22, 24, 26, 28, 30];

const CodeEditorMenu = ({ element }: Props) => {
    const { excalidrawApi } = useGlobal();
    const { language, fontSize } = getCodeBlockSettings(element.customData);

    const updateCodeblock = (props: { language?: CodeEditorLanguage; fontSize?: number }) => {
        if (!excalidrawApi) return;

        const elements = excalidrawApi.getSceneElementsIncludingDeleted().map(current => {
            if (current.id !== element.id) return current;

            return UpdateElementUtil.updateElement(current, draft => {
                draft.customData = CustomData.updateCodeblock(draft.customData, props);
                return draft;
            });
        });

        excalidrawApi.updateScene({ elements });
    };

    const updateFontSize = (value: string) => {
        const size = parseNumber(value);
        if (!size) return;
        updateCodeblock({ fontSize: size });
    };

    return (
        <div className="flex gap-2 items-center absolute z-[3] pointer-events-auto h-full ">
            <div className="bg-[#ECECF4] dark:bg-[#23232A] rounded-lg flex items-center gap-4">
                <select
                    value={language}
                    className="p-2 bg-[#ECECF4] dark:bg-[#23232A] rounded-lg border-none focus:outline-none focus-visible:outline-none"
                    onChange={e =>
                        updateCodeblock({ language: e.target.value as CodeEditorLanguage })
                    }
                >
                    {CODE_EDITOR_LANGUAGES.map(option => (
                        <option key={option} value={option}>
                            {option}
                        </option>
                    ))}
                </select>
            </div>
            <select
                value={fontSize}
                className="p-2 bg-[#ECECF4] dark:bg-[#23232A] rounded-lg border-none focus:outline-none focus-visible:outline-none"
                onChange={e => updateFontSize(e.target.value)}
            >
                {FONT_SIZES.map(fontSizes => (
                    <option key={fontSizes} value={fontSizes}>
                        {fontSizes}
                    </option>
                ))}
            </select>
        </div>
    );
};

export const CodeEditorMenuContainer = ({ element }: Props) => {
    const container = document.getElementById(CUSTOM_CODEBLOCK_MENU_ID);
    if (!container) return null;
    return createPortal(<CodeEditorMenu element={element} />, container);
};
