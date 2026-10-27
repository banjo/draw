import { useGlobal } from "@/contexts/global-context";
import { NativeContainer } from "@/features/draw/models/native/native-container";
import { CodeBlockUtil } from "@/features/draw/utils/code-block-util";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { UpdateElementUtil } from "@/features/draw/utils/update-element-util";
import { CodeEditorLayout } from "@/features/selected-element-visuals/hooks/use-code-block-element";
import {
    CODE_BLOCK_COLORS,
    CODE_BLOCK_FONT_FAMILY,
    CodeBlockImage,
} from "@/features/selected-element-visuals/models/code-block-image";
import { getCodeBlockSettings } from "@/features/selected-element-visuals/models/code-editor-langauges";
import {
    codeHighlightPlugins,
    toPrismLanguage,
} from "@/features/selected-element-visuals/models/code-highlighting";
import { useCodeEditorStore } from "@/features/selected-element-visuals/stores/use-code-editor-store";
import { useLatestCallback } from "@/hooks/use-latest-callback";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import Editor from "@uiw/react-textarea-code-editor/nohighlight";
import { Mutable } from "@excalidraw/excalidraw/utility-types";
import { ExcalidrawElement, ExcalidrawImageElement } from "common";
import React, { useEffect, useRef, useState } from "react";
import "./code-editor.css";

// Collaborators see the code this long after typing stops
const COMMIT_DELAY = 200;
// The light background through Excalidraw's dark mode filter
const DARK_BACKGROUND = "#191a1c";

type Props = {
    element: ExcalidrawElement;
    layout: CodeEditorLayout;
};

/** Edits a code block's code, over its image. Closes on Escape or when it loses focus. */
export const CodeEditor = ({ element, layout }: Props) => {
    const { excalidrawApi } = useGlobal();
    const editorRef = useRef<HTMLTextAreaElement>(null);
    const setEditingElementId = useCodeEditorStore(state => state.setEditingElementId);
    const [code, setCode] = useState(() => CodeBlockImage.getContent(element).code);
    const { language } = getCodeBlockSettings(element.customData);

    const pending = useRef<string>();
    const timer = useRef<ReturnType<typeof setTimeout>>();
    // The block as it was when the editor opened, for undo
    const original = useRef(element);
    const changed = useRef(false);

    const commit = useLatestCallback(() => {
        clearTimeout(timer.current);
        const value = pending.current;
        pending.current = undefined;
        if (!excalidrawApi || value === undefined) return;

        const elements = excalidrawApi.getSceneElementsIncludingDeleted();
        const current = elements.find(e => e.id === element.id);
        if (!current || current.isDeleted) return;
        if (CodeBlockImage.getContent(current).code === value) return;

        const updated = CodeBlockUtil.updateContent(current, { code: value });
        excalidrawApi.addFiles([
            CodeBlockImage.createFile({ ...updated, fileId: CodeBlockUtil.getFileId(updated) }),
        ]);
        // Sent to collaborators, but kept out of undo until the editor closes
        excalidrawApi.updateScene({
            elements: ElementUtil.mergeElements(elements, [updated]),
            captureUpdate: CaptureUpdateAction.NEVER,
        });
        changed.current = true;
    });

    /**
     * Make the whole edit one undo step. Excalidraw only records changes made with
     * `IMMEDIATELY`, so put back the old code without recording it, then the new code.
     * React renders both at once.
     */
    const recordUndoStep = useLatestCallback(() => {
        if (!excalidrawApi || !changed.current) return;
        changed.current = false;

        const current = excalidrawApi
            .getSceneElementsIncludingDeleted()
            .find(e => e.id === element.id);
        if (!current || current.isDeleted) return;

        const withContentOf = (target: ExcalidrawElement, source: ExcalidrawElement) =>
            UpdateElementUtil.updateElement(target, draft => {
                draft.customData = source.customData;
                (draft as Mutable<ExcalidrawImageElement>).fileId = CodeBlockUtil.getFileId(source);
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

    const onChange = (value: string) => {
        setCode(value);
        pending.current = value;
        clearTimeout(timer.current);
        timer.current = setTimeout(commit, COMMIT_DELAY);
    };

    const close = () => {
        commit();
        recordUndoStep();
        setEditingElementId(undefined);
    };

    useEffect(() => {
        const editor = editorRef.current;
        // Without scrolling the page, as the editor can be partly off screen
        editor?.focus({ preventScroll: true });
        editor?.setSelectionRange(editor.value.length, editor.value.length);

        // Closed some other way, e.g. the block was removed or the drawing changed
        return () => {
            commit();
            recordUndoStep();
        };
    }, [commit, recordUndoStep]);

    const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = event => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        close();
        NativeContainer.parse();
        NativeContainer.focus();
    };

    const isDark = layout.theme === "dark";

    return (
        <div
            className="code-block-editor absolute z-[3] overflow-hidden"
            data-color-mode={layout.theme}
            onKeyDown={handleKeyDown}
            style={{
                left: layout.left,
                top: layout.top,
                minWidth: layout.width,
                minHeight: layout.height,
                borderRadius: layout.radius,
                background: isDark ? DARK_BACKGROUND : CODE_BLOCK_COLORS.background,
                boxShadow: "0 0 0 2px var(--color-primary, #6965db)",
            }}
        >
            <Editor
                ref={editorRef}
                value={code}
                language={toPrismLanguage(language)}
                rehypePlugins={codeHighlightPlugins}
                padding={layout.padding}
                onChange={event => onChange(event.target.value)}
                onBlur={close}
                style={{
                    fontSize: layout.fontSize,
                    lineHeight: 1.5,
                    fontFamily: CODE_BLOCK_FONT_FAMILY,
                    background: "transparent",
                }}
            />
        </div>
    );
};
