import { ElementUtil } from "@/features/draw/utils/element-util";
import { UpdateElementUtil } from "@/features/draw/utils/update-element-util";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { Mutable } from "@excalidraw/excalidraw/utility-types";
import { ExcalidrawApi, ExcalidrawElement, ExcalidrawImageElement } from "common";

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

/**
 * Makes the changes to a block's image, made without recording them while typing, one undo
 * step: puts back how it was when typing started without recording it, then the result with
 * recording. Excalidraw only records changes made with `IMMEDIATELY`; React renders both at
 * once.
 */
const recordUndoStep = (excalidrawApi: ExcalidrawApi, original: ExcalidrawElement) => {
    const current = excalidrawApi
        .getSceneElementsIncludingDeleted()
        .find(e => e.id === original.id && !e.isDeleted);
    if (!current) return;

    const before = withContentOf(current, original);
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
};

/** A block's new image and content, sent to collaborators but left out of undo for now */
const applyUnrecorded = (excalidrawApi: ExcalidrawApi, element: ExcalidrawElement) =>
    excalidrawApi.updateScene({
        elements: ElementUtil.mergeElements(excalidrawApi.getSceneElementsIncludingDeleted(), [
            element,
        ]),
        captureUpdate: CaptureUpdateAction.NEVER,
    });

export const BlockEditUtil = { recordUndoStep, applyUnrecorded };
