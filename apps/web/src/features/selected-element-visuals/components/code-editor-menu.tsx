import { useGlobal } from "@/contexts/global-context";
import { NativeBlockMenu } from "@/features/draw/models/native/native-block-menu";
import { CodeBlockUtil } from "@/features/draw/utils/code-block-util";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { CodeBlockImage } from "@/features/selected-element-visuals/models/code-block-image";
import {
    CODE_EDITOR_LANGUAGES,
    CodeEditorLanguage,
    getCodeBlockSettings,
} from "@/features/selected-element-visuals/models/code-editor-langauges";
import { parseNumber } from "@banjoanton/utils";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { ExcalidrawElement } from "common";
import { createPortal } from "react-dom";

type Props = {
    element: ExcalidrawElement;
};

const FONT_SIZES = [12, 14, 16, 18, 20, 22, 24, 26, 28, 30];

const CodeEditorMenu = ({ element }: Props) => {
    const { excalidrawApi } = useGlobal();
    const { language, fontSize } = getCodeBlockSettings(element.customData);

    const updateCodeblock = (props: { language?: CodeEditorLanguage; fontSize?: number }) => {
        if (!excalidrawApi) return;

        const elements = excalidrawApi.getSceneElementsIncludingDeleted();
        const current = elements.find(e => e.id === element.id);
        if (!current) return;

        const updated = CodeBlockUtil.updateContent(current, props);
        excalidrawApi.addFiles([
            CodeBlockImage.createFile({ ...updated, fileId: CodeBlockUtil.getFileId(updated) }),
        ]);
        excalidrawApi.updateScene({
            elements: ElementUtil.mergeElements(elements, [updated]),
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
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
    const container = NativeBlockMenu.getContainer();
    if (!container) return null;
    return createPortal(<CodeEditorMenu element={element} />, container);
};
