import { ExcalidrawUtil } from "@/features/draw/utils/excalidraw-util";
import { UpdateElementUtil } from "@/features/draw/utils/update-element-util";
import {
    CODE_EDITOR_LANGUAGES,
    CodeEditorLanguage,
} from "@/features/selected-element-visuals/models/code-editor-langauges";
import { useCodeEditorStore } from "@/features/selected-element-visuals/stores/use-code-editor-store";
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

const CodeEditorMenu = ({ element }: Props) => {
    const selected = useCodeEditorStore(state => state.selectedLanguage);
    const setSelected = useCodeEditorStore(state => state.setSelectedLanguage);

    const updateValue = (value: CodeEditorLanguage) => {
        setSelected(value);
        UpdateElementUtil.mutateElement(element, (element, helpers) => {
            element.customData = CustomData.updateCodeblock(element.customData, {
                language: value,
            });
        });
    };

    return (
        <div
            className={`absolute z-[3] pointer-events-auto h-full bg-[#ECECF4] rounded-lg flex items-center gap-4`}
        >
            <select
                value={selected}
                className="p-2 bg-[#ECECF4] rounded-lg border-none focus:outline-none focus-visible:outline-none"
                onChange={e => updateValue(e.target.value as CodeEditorLanguage)}
            >
                {CODE_EDITOR_LANGUAGES.map(language => (
                    <option key={language} value={language}>
                        {language}
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
