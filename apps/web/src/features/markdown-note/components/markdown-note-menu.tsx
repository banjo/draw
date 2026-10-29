import { useGlobal } from "@/contexts/global-context";
import { NativeBlockMenu } from "@/features/draw/models/native/native-block-menu";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { cn } from "ui";
import { MarkdownNote, NOTE_LOOKS, NOTE_WIDTHS } from "../models/markdown-note";
import type { NoteContent, NoteLook } from "../models/note-render";
import { useMarkdownNoteStore } from "../stores/use-markdown-note-store";

const Option = ({
    isActive,
    onClick,
    label,
}: {
    isActive: boolean;
    onClick: () => void;
    label: string;
}) => (
    <button
        type="button"
        onClick={onClick}
        className={cn(
            "h-full rounded-md px-2.5",
            isActive
                ? "bg-[#e0dfff] font-semibold text-[#4a47b1] dark:bg-[#403e6a] dark:text-[#e0dfff]"
                : "hover:bg-black/5 dark:hover:bg-white/10"
        )}
    >
        {label}
    </button>
);

/** A note's look and width, while it's selected */
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
        <div className="pointer-events-auto absolute z-[3] flex h-full items-center gap-2 text-sm">
            <div className="flex h-full items-center gap-0.5 rounded-lg bg-[#ECECF4] p-1 dark:bg-[#23232A]">
                {NOTE_LOOKS.map(option => (
                    <Option
                        key={option.look}
                        label={option.label}
                        isActive={look === option.look}
                        onClick={() => void change({ look: option.look })}
                    />
                ))}
            </div>
            <div className="flex h-full items-center gap-0.5 rounded-lg bg-[#ECECF4] p-1 dark:bg-[#23232A]">
                {Object.entries(NOTE_WIDTHS).map(([label, value]) => (
                    <Option
                        key={label}
                        label={label}
                        isActive={width === value}
                        onClick={() => void change({ width: value })}
                    />
                ))}
            </div>
        </div>
    );
};

/** In Excalidraw's footer while a note is selected */
export const MarkdownNoteMenuContainer = () => {
    const selected = useMarkdownNoteStore(state => state.selected);
    const container = NativeBlockMenu.getContainer();
    if (!selected || !container) return null;
    return createPortal(<MarkdownNoteMenu {...selected} />, container);
};
