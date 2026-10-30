import { useGlobal } from "@/contexts/global-context";
import {
    ActionButton,
    BlockSettings,
    Choices,
    Setting,
} from "@/features/draw/components/block-settings";
import { NativeBlockSettings } from "@/features/draw/models/native/native-block-settings";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { Pencil } from "lucide-react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { MarkdownNote, NOTE_LOOKS, NOTE_WIDTHS } from "../models/markdown-note";
import type { NoteContent, NoteLook } from "../models/note-render";
import { useMarkdownNoteStore } from "../stores/use-markdown-note-store";

/** A note's look and width, in Excalidraw's sidebar */
const MarkdownNoteMenu = ({ id, look, width }: { id: string; look: NoteLook; width: number }) => {
    const { excalidrawApi } = useGlobal();

    const change = async (changes: Partial<NoteContent>) => {
        if (!excalidrawApi) return;
        const current = excalidrawApi.getSceneElements().find(e => e.id === id);
        if (!current) return;
        try {
            const updated = await MarkdownNote.update(current, changes);
            excalidrawApi.addFiles([updated.file]);
            excalidrawApi.updateScene({
                elements: ElementUtil.mergeElements(
                    excalidrawApi.getSceneElementsIncludingDeleted(),
                    [updated.element]
                ),
                captureUpdate: CaptureUpdateAction.IMMEDIATELY,
            });
        } catch {
            toast.error("Couldn't draw the note");
        }
    };

    return (
        <BlockSettings>
            <Setting label="Look">
                <Choices
                    options={NOTE_LOOKS.map(option => ({
                        value: option.look,
                        label: option.label,
                    }))}
                    value={look}
                    onChange={value => void change({ look: value })}
                />
            </Setting>
            <Setting label="Width">
                <Choices
                    options={Object.entries(NOTE_WIDTHS).map(([label, value]) => ({
                        value,
                        label,
                    }))}
                    value={width}
                    onChange={value => void change({ width: value })}
                />
            </Setting>
            <ActionButton
                isPrimary
                shortcut="↵"
                icon={<Pencil className="h-3.5 w-3.5" />}
                onClick={() => useMarkdownNoteStore.getState().setEditingId(id)}
            >
                Edit text
            </ActionButton>
        </BlockSettings>
    );
};

/** In Excalidraw's sidebar while a note is selected */
export const MarkdownNoteMenuContainer = () => {
    const selected = useMarkdownNoteStore(state => state.selected);
    if (!selected) return null;
    return createPortal(<MarkdownNoteMenu {...selected} />, NativeBlockSettings.container);
};
