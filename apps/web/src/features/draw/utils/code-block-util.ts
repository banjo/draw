import { ElementCreationUtil } from "@/features/draw/utils/element-creation-util";
import { UpdateElementUtil } from "@/features/draw/utils/update-element-util";
import {
    CodeBlockContent,
    CodeBlockImage,
} from "@/features/selected-element-visuals/models/code-block-image";
import { FileId } from "@excalidraw/excalidraw/element/types";
import { Mutable } from "@excalidraw/excalidraw/utility-types";
import { CustomData, ExcalidrawElement, ExcalidrawImageElement } from "common";

const isImage = (element: ExcalidrawElement): element is ExcalidrawImageElement =>
    element.type === "image";

/**
 * Change a code block's code, language, or font size. It gets a new image, and keeps the
 * scale it was resized to.
 */
const updateContent = (element: ExcalidrawElement, changes: Partial<CodeBlockContent>) => {
    const before = CodeBlockImage.getContent(element);
    const after = { ...before, ...changes };

    const naturalBefore = CodeBlockImage.getNaturalSize(before);
    const scale = naturalBefore.width > 0 ? element.width / naturalBefore.width : 1;
    const { width, height } = CodeBlockImage.getNaturalSize(after);

    return UpdateElementUtil.updateElement(element, draft => {
        draft.customData = CustomData.updateCodeblock(draft.customData, after);
        (draft as Mutable<ExcalidrawImageElement>).fileId = CodeBlockImage.getFileId(after);
        draft.width = width * scale;
        draft.height = height * scale;
        return draft;
    });
};

/** Code blocks used to be rectangles with the code drawn on top in HTML */
const isLegacy = (element: ExcalidrawElement) => !isImage(element);

/** The image version of an old code block, with the same id, place, and links */
const fromLegacy = (element: ExcalidrawElement): ExcalidrawElement => {
    const content = CodeBlockImage.getContent(element);
    const { width, height } = CodeBlockImage.getNaturalSize(content);

    return ElementCreationUtil.createImage({
        base: { x: element.x, y: element.y, width, height },
        fileId: CodeBlockImage.getFileId(content),
        callback: draft => {
            draft.id = element.id;
            draft.customData = element.customData;
            draft.groupIds = element.groupIds;
            draft.frameId = element.frameId;
            draft.boundElements = element.boundElements;
            draft.angle = element.angle;
            draft.link = element.link;
            draft.locked = element.locked;
            draft.index = element.index;
            draft.isDeleted = element.isDeleted;
            // Newer than the rectangle, so it replaces it for everyone
            draft.version = element.version + 1;
            return draft;
        },
    });
};

const getFileId = (element: ExcalidrawElement): FileId | null =>
    isImage(element) ? element.fileId : null;

export const CodeBlockUtil = {
    updateContent,
    isLegacy,
    fromLegacy,
    getFileId,
};
