import { ExcalidrawUtil } from "@/features/draw/utils/excalidraw-util";
import {
    CODE_EDITOR_LANGUAGES,
    CodeEditorLanguage,
} from "@/features/selected-element-visuals/models/code-editor-langauges";
import { useCodeEditorStore } from "@/features/selected-element-visuals/stores/use-code-editor-store";
import { createPortal } from "react-dom";

export const CUSTOM_CODEBLOCK_MENU_ID = "custom-codeblock-menu";

export const initCodeblockMenuElement = () => {
    ExcalidrawUtil.createCustomNativeElement(
        CUSTOM_CODEBLOCK_MENU_ID,
        ".layer-ui__wrapper footer",
        1
    );
};

const CodeEditorMenu = () => {
    const selected = useCodeEditorStore(state => state.selectedLanguage);
    const setSelected = useCodeEditorStore(state => state.setSelectedLanguage);
    return (
        <div className="absolute z-[3] pointer-events-auto h-full bg-[#ECECF4] rounded-lg flex items-center gap-4">
            <select
                value={selected}
                className="p-2 bg-[#ECECF4] rounded-lg border-none focus:outline-none focus-visible:outline-none"
                onChange={e => setSelected(e.target.value as CodeEditorLanguage)}
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

export const CodeEditorMenuContainer = () => {
    const element = document.getElementById(CUSTOM_CODEBLOCK_MENU_ID);
    if (!element) return null;
    return createPortal(<CodeEditorMenu />, element);
};
