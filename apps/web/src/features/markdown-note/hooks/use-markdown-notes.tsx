import { useGlobal } from "@/contexts/global-context";
import { OnChangeCallback } from "@/features/draw/draw";
import { CustomDataUtil } from "@/features/draw/utils/custom-data-util";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { ExcalidrawUtil } from "@/features/draw/utils/excalidraw-util";
import { CaptureUpdateAction, viewportCoordsToSceneCoords } from "@excalidraw/excalidraw";
import { AppState } from "@excalidraw/excalidraw/types";
import { ExcalidrawElement, ExcalidrawElements } from "common";
import React, { useMemo, useRef } from "react";
import { MarkdownNoteEditor } from "../components/markdown-note-editor";
import { MarkdownNoteMenuContainer } from "../components/markdown-note-menu";
import { MarkdownNote } from "../models/markdown-note";
import type { CheckboxBox, LinkBox } from "../models/note-render";
import { useMarkdownNoteStore } from "../stores/use-markdown-note-store";

const NOTE_SELECTED_CLASS = "markdown-note-selected";
// Further than this between pressing and letting go is a drag, not a click
const CLICK_DISTANCE = 4;

const isLiveNote = (element: ExcalidrawElement) =>
    CustomDataUtil.isMarkdownNote(element) && !element.isDeleted;

const isInside = (element: ExcalidrawElement, x: number, y: number) =>
    x >= element.x &&
    x <= element.x + element.width &&
    y >= element.y &&
    y <= element.y + element.height;

const EditorContainer = () => {
    const { excalidrawApi } = useGlobal();
    const editingId = useMarkdownNoteStore(state => state.editingId);
    const element = editingId
        ? excalidrawApi?.getSceneElements().find(e => e.id === editingId)
        : undefined;
    return element ? <MarkdownNoteEditor key={element.id} element={element} /> : null;
};

/** The note selected on its own, if any */
const getSelectedNote = (elements: ExcalidrawElements, appState: AppState) => {
    const selection = ElementUtil.getSelectedElements(appState, elements);
    const [note] = selection;
    if (selection.length !== 1 || !note || !isLiveNote(note)) return undefined;
    const { look, width } = MarkdownNote.getContent(note);
    return { id: note.id, look, width };
};

type HitAreas = { checkboxes: CheckboxBox[]; links: LinkBox[] };
type Hit = { kind: "checkbox"; box: CheckboxBox } | { kind: "link"; box: LinkBox };

// Around a checkbox, as it's small
const CHECKBOX_MARGIN = 3;

/** Links that open in a new tab: web and mail addresses, with https:// when left out */
const toSafeUrl = (href: string) => {
    if (/^(https?:|mailto:)/i.test(href)) return href;
    if (/^[a-z][\w+.-]*:/i.test(href)) return undefined;
    return `https://${href.replace(/^\/\//, "")}`;
};

/**
 * Markdown notes: their images, made in each browser from the Markdown like code blocks', the
 * editor, the menu, and ticking a checkbox or opening a link with a click
 */
export const useMarkdownNotes = () => {
    const { excalidrawApi } = useGlobal();
    // The images being made, and where each image's checkboxes and links are
    const rendering = useRef(new Set<string>());
    const hitAreas = useRef(new Map<string, HitAreas>());
    const pointerDown = useRef<{ x: number; y: number }>();

    /** Makes the image of each note that doesn't have one yet */
    const renderMissing = (notes: ExcalidrawElement[]) => {
        if (!excalidrawApi) return;
        const files = excalidrawApi.getFiles();

        for (const note of notes) {
            if (!ExcalidrawUtil.isImageElement(note) || !note.fileId) continue;
            const fileId = note.fileId;
            if (rendering.current.has(fileId)) continue;
            if (files[fileId] && hitAreas.current.has(fileId)) continue;

            rendering.current.add(fileId);
            MarkdownNote.render(MarkdownNote.getContent(note))
                .then(({ file, checkboxes, links }) => {
                    hitAreas.current.set(fileId, { checkboxes, links });
                    // Under the note's id, which another browser may have made from older code
                    if (!excalidrawApi.getFiles()[fileId])
                        excalidrawApi.addFiles([{ ...file, id: fileId }]);
                })
                .catch(() => undefined)
                .finally(() => rendering.current.delete(fileId));
        }
    };

    const updateMarkdownNotes: OnChangeCallback = (elements, appState) => {
        const notes = elements.filter(isLiveNote);
        renderMissing(notes);

        const {
            editingId,
            setEditingId,
            selected: current,
            setSelected,
        } = useMarkdownNoteStore.getState();
        // Removed while it was being written in, e.g. by someone else
        if (editingId && !notes.some(note => note.id === editingId)) setEditingId(undefined);

        const next = getSelectedNote(elements, appState);
        const isSame =
            current?.id === next?.id &&
            current?.look === next?.look &&
            current?.width === next?.width;
        if (!isSame) setSelected(next);

        // Excalidraw's hint is about cropping, which a note's image isn't for
        document.body.classList.toggle(NOTE_SELECTED_CLASS, Boolean(next));
    };

    const findNoteAt = (event: React.MouseEvent) => {
        if (!excalidrawApi || !(event.target instanceof HTMLCanvasElement)) return undefined;
        const { x, y } = viewportCoordsToSceneCoords(event, excalidrawApi.getAppState());
        const note = excalidrawApi
            .getSceneElements()
            .filter(isLiveNote)
            .findLast(e => isInside(e, x, y));
        return note && { note, x, y };
    };

    /** Double-clicking a note writes in it, instead of cropping the image */
    const onDoubleClickCapture = (event: React.MouseEvent) => {
        const hit = findNoteAt(event);
        if (!hit) return;
        event.preventDefault();
        event.stopPropagation();
        useMarkdownNoteStore.getState().setEditingId(hit.note.id);
    };

    const onPointerDownCapture = (event: React.PointerEvent) => {
        pointerDown.current = { x: event.clientX, y: event.clientY };
    };

    /** The checkbox or link at the pointer, on a note */
    const findHit = (event: React.MouseEvent) => {
        if (excalidrawApi?.getAppState().activeTool.type !== "selection") return undefined;
        const at = findNoteAt(event);
        if (!at || !ExcalidrawUtil.isImageElement(at.note)) return undefined;

        const { note } = at;
        const areas = hitAreas.current.get(note.fileId ?? "");
        // The image's own size, as the note may have been resized
        const scale = MarkdownNote.getContent(note).width / note.width;
        const x = (at.x - note.x) * scale;
        const y = (at.y - note.y) * scale;

        const checkbox = areas?.checkboxes.find(
            box =>
                x >= box.x - CHECKBOX_MARGIN &&
                x <= box.x + box.size + CHECKBOX_MARGIN &&
                y >= box.y - CHECKBOX_MARGIN &&
                y <= box.y + box.size + CHECKBOX_MARGIN
        );
        if (checkbox) return { note, hit: { kind: "checkbox", box: checkbox } as Hit };

        const link = areas?.links.find(
            box => x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height
        );
        return link ? { note, hit: { kind: "link", box: link } as Hit } : undefined;
    };

    const toggle = (note: ExcalidrawElement, box: CheckboxBox) => {
        if (!excalidrawApi) return;
        const markdown = MarkdownNote.toggleCheckbox(
            MarkdownNote.getContent(note).markdown,
            box.index
        );
        void MarkdownNote.update(note, { markdown }).then(({ element, file }) => {
            excalidrawApi.addFiles([file]);
            excalidrawApi.updateScene({
                elements: ElementUtil.mergeElements(
                    excalidrawApi.getSceneElementsIncludingDeleted(),
                    [element]
                ),
                captureUpdate: CaptureUpdateAction.IMMEDIATELY,
            });
        });
    };

    /** A click on a checkbox ticks or unticks it; on a link, opens it in a new tab */
    const onClickCapture = (event: React.MouseEvent) => {
        // Only the first click of a double-click, which writes in the note
        if (event.detail > 1) return;
        const start = pointerDown.current;
        const isClick =
            start && Math.hypot(event.clientX - start.x, event.clientY - start.y) < CLICK_DISTANCE;
        const found = isClick ? findHit(event) : undefined;
        if (!found) return;

        if (found.hit.kind === "checkbox") {
            toggle(found.note, found.hit.box);
            return;
        }
        const url = toSafeUrl(found.hit.box.href);
        if (url) window.open(url, "_blank", "noopener,noreferrer");
    };

    /** A hand over checkboxes and links, set after Excalidraw sets its own cursor */
    const onPointerMove = (event: React.PointerEvent) => {
        if (event.buttons !== 0 || !(event.target instanceof HTMLCanvasElement)) return;
        if (findHit(event)) event.target.style.cursor = "pointer";
    };

    const markdownNotes = useMemo(
        () =>
            excalidrawApi ? (
                <>
                    <EditorContainer />
                    <MarkdownNoteMenuContainer />
                </>
            ) : null,
        [excalidrawApi]
    );

    return {
        markdownNotes,
        updateMarkdownNotes,
        onDoubleClickCapture,
        handlePointerDownCapture: onPointerDownCapture,
        handleClickCapture: onClickCapture,
        handlePointerMove: onPointerMove,
    };
};
