import { useGlobal } from "@/contexts/global-context";
import {
    ActionButton,
    BlockSettings,
    Select,
    Setting,
    Stepper,
} from "@/features/draw/components/block-settings";
import { NativeBlockSettings } from "@/features/draw/models/native/native-block-settings";
import { CodeBlockUtil } from "@/features/draw/utils/code-block-util";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { CodeBlockImage } from "@/features/selected-element-visuals/models/code-block-image";
import {
    CODE_EDITOR_LANGUAGES,
    CodeEditorLanguage,
    getCodeBlockSettings,
} from "@/features/selected-element-visuals/models/code-editor-langauges";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { ExcalidrawElement } from "common";
import { Pencil } from "lucide-react";
import { createPortal } from "react-dom";
import { useCodeEditorStore } from "../stores/use-code-editor-store";

type Props = {
    element: ExcalidrawElement;
};

const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 30;

/** A code block's language and font size, in Excalidraw's sidebar */
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

    return (
        <BlockSettings>
            <Setting label="Language">
                <Select
                    label="Language"
                    value={language}
                    options={CODE_EDITOR_LANGUAGES}
                    onChange={value => updateCodeblock({ language: value })}
                />
            </Setting>
            <Setting label="Font size">
                <Stepper
                    name="size"
                    value={fontSize}
                    min={MIN_FONT_SIZE}
                    max={MAX_FONT_SIZE}
                    step={2}
                    onChange={value => updateCodeblock({ fontSize: value })}
                />
            </Setting>
            <ActionButton
                isPrimary
                shortcut="↵"
                icon={<Pencil className="h-3.5 w-3.5" />}
                onClick={() => useCodeEditorStore.getState().setEditingElementId(element.id)}
            >
                Edit code
            </ActionButton>
        </BlockSettings>
    );
};

export const CodeEditorMenuContainer = ({ element }: Props) =>
    createPortal(<CodeEditorMenu element={element} />, NativeBlockSettings.container);
