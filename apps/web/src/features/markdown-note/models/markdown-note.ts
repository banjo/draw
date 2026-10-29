import { ElementCreationUtil } from "@/features/draw/utils/element-creation-util";
import { UpdateElementUtil } from "@/features/draw/utils/update-element-util";
import { hashString } from "@excalidraw/excalidraw";
import { FileId } from "@excalidraw/excalidraw/element/types";
import { BinaryFileData, DataURL } from "@excalidraw/excalidraw/types";
import { Mutable } from "@excalidraw/excalidraw/utility-types";
import { CustomDataMarkdown, ExcalidrawElement, ExcalidrawImageElement } from "common";
import { loadNoteFonts } from "./note-fonts";
import type { NoteContent, NoteLook } from "./note-render";

/** The widths a note can have, narrow to wide */
export const NOTE_WIDTHS = { S: 260, M: 340, L: 460 } as const;
export const NOTE_LOOKS: { look: NoteLook; label: string }[] = [
    { look: "paper", label: "Paper" },
    { look: "hand", label: "Handwritten" },
];

const DEFAULT_CONTENT: NoteContent = {
    markdown: `# Note

Double-click to write in **Markdown**: lists, \`code\`, [links](https://draw.banjoanton.com) and checkboxes.

- [ ] Something to do
- [x] Something done`,
    look: "paper",
    width: NOTE_WIDTHS.M,
};

// Bumped when the drawing changes, so notes get new images
const IMAGE_VERSION = 1;

const getContent = (element: ExcalidrawElement): NoteContent => {
    const data = element.customData as Partial<CustomDataMarkdown> | undefined;
    return {
        markdown: data?.markdown ?? "",
        look: data?.look === "hand" ? "hand" : "paper",
        width: data?.width ?? NOTE_WIDTHS.M,
    };
};

/** The same content always gets the same id, so every browser can make the file itself */
const getFileId = ({ markdown, look, width }: NoteContent) =>
    `markdown-${IMAGE_VERSION}-${hashString(`${look}\n${width}\n${markdown}`)}-${markdown.length}` as FileId;

const toBase64 = (text: string) => {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    bytes.forEach(byte => (binary += String.fromCharCode(byte)));
    return btoa(binary);
};

/** The note drawn, with its file and size at scale 1 */
const render = async (content: NoteContent) => {
    // Loaded with the first note, as Markdown's parser is large
    const [fonts, { renderNote }] = await Promise.all([loadNoteFonts(), import("./note-render")]);
    const { svg, width, height, checkboxes, links } = renderNote(content, fonts);
    const file: BinaryFileData = {
        id: getFileId(content),
        mimeType: "image/svg+xml",
        dataURL: `data:image/svg+xml;base64,${toBase64(svg)}` as DataURL,
        created: Date.now(),
    };
    return { file, width, height, checkboxes, links };
};

const toCustomData = (content: NoteContent): CustomDataMarkdown => ({
    shadow: false,
    type: "markdown",
    ...content,
});

/** A new note at 0,0 with its file */
const create = async (changes: Partial<NoteContent> = {}) => {
    const content = { ...DEFAULT_CONTENT, ...changes };
    const { file, width, height } = await render(content);
    const element = ElementCreationUtil.createImage({
        base: { x: 0, y: 0, width, height },
        fileId: file.id,
        callback: draft => {
            draft.customData = toCustomData(content);
            return draft;
        },
    });
    return { element, file };
};

/**
 * The note with new content, and its new file. It keeps the scale it was resized to, and
 * its top left corner.
 */
const update = async (element: ExcalidrawElement, changes: Partial<NoteContent>) => {
    const before = getContent(element);
    const after = { ...before, ...changes };
    const { file, width, height } = await render(after);
    const scale = element.width / before.width;

    const updated = UpdateElementUtil.updateElement(element, draft => {
        draft.customData = toCustomData(after);
        (draft as Mutable<ExcalidrawImageElement>).fileId = file.id;
        draft.width = width * scale;
        draft.height = height * scale;
        return draft;
    });
    return { element: updated, file };
};

// A task item's checkbox in the Markdown: "- [ ]", "* [x]", "1. [X]"
const TASK = /^\s*(?:[-*+]|\d+[.)])\s+\[[ xX]\]/gm;

/** The Markdown with the checkbox at `index` ticked or unticked */
const toggleCheckbox = (markdown: string, index: number) => {
    let count = 0;
    return markdown.replace(TASK, task => {
        if (count++ !== index) return task;
        return task.endsWith("[ ]") ? `${task.slice(0, -3)}[x]` : `${task.slice(0, -3)}[ ]`;
    });
};

export const MarkdownNote = { getContent, getFileId, render, create, update, toggleCheckbox };
