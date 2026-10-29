import { Hint } from "@/components/keys";
import { useGlobal } from "@/contexts/global-context";
import { NativeContainer } from "@/features/draw/models/native/native-container";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { UpdateElementUtil } from "@/features/draw/utils/update-element-util";
import { useLatestCallback } from "@/hooks/use-latest-callback";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { Mutable } from "@excalidraw/excalidraw/utility-types";
import { ExcalidrawElement, ExcalidrawImageElement } from "common";
import { X } from "lucide-react";
import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { MarkdownNote } from "../models/markdown-note";
import { useMarkdownNoteStore } from "../stores/use-markdown-note-store";

// The note shows what's typed this long after typing stops
const COMMIT_DELAY = 150;

/** Writes a note's Markdown, in a panel at the side, with the note changing as you type */
export const MarkdownNoteEditor = ({ element }: { element: ExcalidrawElement }) => {
    const { excalidrawApi } = useGlobal();
    const [markdown, setMarkdown] = useState(() => MarkdownNote.getContent(element).markdown);
    const textarea = useRef<HTMLTextAreaElement>(null);

    const pending = useRef<string>();
    const timer = useRef<ReturnType<typeof setTimeout>>();
    // The note as it was when the editor opened, for undo
    const original = useRef(element);
    const changed = useRef(false);
    const lastCommit = useRef(Promise.resolve());

    const getCurrent = () =>
        excalidrawApi
            ?.getSceneElementsIncludingDeleted()
            .find(e => e.id === element.id && !e.isDeleted);

    /** One at a time and in order, as drawing a note takes a moment */
    const commit = useLatestCallback(() => {
        clearTimeout(timer.current);
        const value = pending.current;
        pending.current = undefined;
        if (value === undefined) return lastCommit.current;

        lastCommit.current = lastCommit.current.then(async () => {
            const current = getCurrent();
            if (!excalidrawApi || !current) return;
            if (MarkdownNote.getContent(current).markdown === value) return;

            const { element: updated, file } = await MarkdownNote.update(current, {
                markdown: value,
            });
            excalidrawApi.addFiles([file]);
            // Sent to collaborators, but kept out of undo until the editor closes
            excalidrawApi.updateScene({
                elements: ElementUtil.mergeElements(
                    excalidrawApi.getSceneElementsIncludingDeleted(),
                    [updated]
                ),
                captureUpdate: CaptureUpdateAction.NEVER,
            });
            changed.current = true;
        });
        return lastCommit.current;
    });

    /**
     * Make the whole edit one undo step: put back the old note without recording it, then
     * the new one with recording, as the code block's editor does.
     */
    const recordUndoStep = useLatestCallback(() => {
        const current = getCurrent();
        if (!excalidrawApi || !changed.current || !current) return;
        changed.current = false;

        const withContentOf = (target: ExcalidrawElement, source: ExcalidrawElement) =>
            UpdateElementUtil.updateElement(target, draft => {
                draft.customData = source.customData;
                (draft as Mutable<ExcalidrawImageElement>).fileId = (
                    source as ExcalidrawImageElement
                ).fileId;
                draft.width = source.width;
                draft.height = source.height;
                return draft;
            });

        const before = withContentOf(current, original.current);
        excalidrawApi.updateScene({
            elements: ElementUtil.mergeElements(excalidrawApi.getSceneElementsIncludingDeleted(), [
                before,
            ]),
            captureUpdate: CaptureUpdateAction.NEVER,
        });
        excalidrawApi.updateScene({
            elements: ElementUtil.mergeElements(excalidrawApi.getSceneElementsIncludingDeleted(), [
                withContentOf(before, current),
            ]),
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
    });

    const finish = useLatestCallback(async () => {
        await commit().catch(() => undefined);
        recordUndoStep();
    });

    const close = () => {
        void finish();
        useMarkdownNoteStore.getState().setEditingId(undefined);
        NativeContainer.parse();
        NativeContainer.focus();
    };

    useEffect(() => {
        const field = textarea.current;
        field?.focus({ preventScroll: true });
        field?.setSelectionRange(field.value.length, field.value.length);
        // Closed some other way, e.g. the note was removed or the drawing changed
        return () => void finish();
    }, [finish]);

    const onChange = (value: string) => {
        setMarkdown(value);
        pending.current = value;
        clearTimeout(timer.current);
        timer.current = setTimeout(() => void commit(), COMMIT_DELAY);
    };

    const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === "Escape") {
            event.stopPropagation();
            close();
        }
    };

    return (
        <div
            role="dialog"
            aria-label="Markdown note"
            className="fixed right-4 top-[72px] z-[4] flex h-[min(520px,calc(100dvh-160px))] w-[min(400px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl bg-white text-[#1b1b1f] shadow-[0_30px_70px_-24px_rgba(25,25,60,0.45),0_0_0_1px_rgba(20,20,40,0.07)] duration-200 animate-in fade-in-0 slide-in-from-right-2 dark:bg-[#1d1d23] dark:text-[#ececf1] dark:shadow-[0_30px_70px_-24px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.07)] dark:[color-scheme:dark]"
        >
            <header className="flex h-12 shrink-0 items-center border-b border-black/[0.07] px-4 dark:border-white/[0.07]">
                <h2 className="text-[15px] font-semibold">Markdown note</h2>
                <button
                    type="button"
                    onMouseDown={event => event.preventDefault()}
                    onClick={close}
                    aria-label="Close"
                    className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-zinc-400 hover:bg-black/5 hover:text-[#1b1b1f] dark:hover:bg-white/10 dark:hover:text-white"
                >
                    <X className="h-4 w-4" />
                </button>
            </header>
            <textarea
                ref={textarea}
                value={markdown}
                onChange={event => onChange(event.target.value)}
                onKeyDown={onKeyDown}
                onBlur={close}
                spellCheck={false}
                aria-label="Markdown"
                className="min-h-0 flex-1 resize-none bg-[#f6f8fa] p-4 font-mono text-[13px] leading-relaxed text-[#1f2328] outline-none dark:bg-[#18181d] dark:text-[#e3e3e8]"
            />
            <footer className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-black/[0.07] bg-black/[0.02] px-4 py-2.5 font-mono text-[11.5px] text-zinc-500 dark:border-white/[0.07] dark:bg-white/[0.02] dark:text-zinc-400">
                <span># Title</span>
                <span>**bold**</span>
                <span>*italic*</span>
                <span>`code`</span>
                <span>- [ ] task</span>
                <span>&gt; quote</span>
                <span className="ml-auto font-sans">
                    <Hint keys={["esc"]}>Close</Hint>
                </span>
            </footer>
        </div>
    );
};
