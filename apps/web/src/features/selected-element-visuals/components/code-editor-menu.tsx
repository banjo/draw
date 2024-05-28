import { ExcalidrawUtil } from "@/features/draw/utils/excalidraw-util";
import { UpdateElementUtil } from "@/features/draw/utils/update-element-util";
import {
    CODE_EDITOR_LANGUAGES,
    CodeEditorLanguage,
} from "@/features/selected-element-visuals/models/code-editor-langauges";
import { useCodeEditorStore } from "@/features/selected-element-visuals/stores/use-code-editor-store";
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
    const selectedLanguage = useCodeEditorStore(state => state.selectedLanguage);
    const setSelectedLanguage = useCodeEditorStore(state => state.setSelectedLanguage);

    const selectedFontSize = useCodeEditorStore(state => state.fontSize);
    const setSelectedFontSize = useCodeEditorStore(state => state.setFontSize);

    const updateLanguage = (language: CodeEditorLanguage) => {
        setSelectedLanguage(language);
        UpdateElementUtil.mutateElement(element, element => {
            element.customData = CustomData.updateCodeblock(element.customData, {
                language: language,
            });
        });
    };

    const updateFontSize = (value: string) => {
        const fontSize = parseNumber(value);

        if (!fontSize) return;

        setSelectedFontSize(fontSize);
        UpdateElementUtil.mutateElement(element, element => {
            element.customData = CustomData.updateCodeblock(element.customData, {
                fontSize: fontSize,
            });
        });
    };

    return (
        <div className="flex gap-2 items-center absolute z-[3] pointer-events-auto h-full ">
            <div className={`bg-[#ECECF4] rounded-lg flex items-center gap-4`}>
                <select
                    value={selectedLanguage}
                    className="p-2 bg-[#ECECF4] rounded-lg border-none focus:outline-none focus-visible:outline-none"
                    onChange={e => updateLanguage(e.target.value as CodeEditorLanguage)}
                >
                    {CODE_EDITOR_LANGUAGES.map(language => (
                        <option key={language} value={language}>
                            {language}
                        </option>
                    ))}
                </select>
            </div>
            <select
                value={selectedFontSize}
                className="p-2 bg-[#ECECF4] rounded-lg border-none focus:outline-none focus-visible:outline-none"
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
