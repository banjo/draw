import { useGlobal } from "@/contexts/global-context";
import { CustomDataUtil } from "@/features/draw/utils/custom-data-util";
import { ElementCreationUtil } from "@/features/draw/utils/element-creation-util";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { ExcalidrawUtil } from "@/features/draw/utils/excalidraw-util";
import { FileUtil } from "@/features/draw/utils/file-util";
import { FrameUtil } from "@/features/draw/utils/frame-util";
import { MarkdownNote } from "@/features/markdown-note/models/markdown-note";
import { SwimlaneLayout } from "@/features/swimlane/models/swimlane-layout";
import { Table } from "@/features/table/models/table";
import {
    CaptureUpdateAction,
    getVisibleSceneBounds,
    viewportCoordsToSceneCoords,
} from "@excalidraw/excalidraw";
import { ExcalidrawElements } from "common";
import { ElementItem, IconItem } from "../models/add-element-item";
import { IconImageStore } from "../services/icon-image-store";

/** The longest side of an added icon */
const ICON_SIZE = 100;
/** Between things added one after another */
const GAP = 40;

export type Bounds = readonly [minX: number, minY: number, maxX: number, maxY: number];

/** Centered on a point, or to the right of what was added just before */
export type Placement = { center: { x: number; y: number } } | { after: Bounds };

export type ClientPoint = { clientX: number; clientY: number };

const moveElements = (elements: ExcalidrawElements, dx: number, dy: number) =>
    elements.map(element => ({ ...element, x: element.x + dx, y: element.y + dy }));

/** Moves the elements to the placement */
export const placeElements = (elements: ExcalidrawElements, placement: Placement) => {
    const [minX, minY, maxX, maxY] = ExcalidrawUtil.getCommonBounds(elements);
    const width = maxX - minX;
    const height = maxY - minY;

    if ("center" in placement) {
        const { x, y } = placement.center;
        return moveElements(elements, x - width / 2 - minX, y - height / 2 - minY);
    }

    const [, afterMinY, afterMaxX, afterMaxY] = placement.after;
    const centerY = (afterMinY + afterMaxY) / 2;
    return moveElements(elements, afterMaxX + GAP - minX, centerY - height / 2 - minY);
};

/** Adds shapes, blocks and icons from the palette to the drawing */
export const useInsertElement = () => {
    const { excalidrawApi } = useGlobal();

    /** At the pointer when it's over the canvas, else in the middle of the screen */
    const getStartPlacement = (pointer?: ClientPoint): Placement | undefined => {
        if (!excalidrawApi) return undefined;
        const appState = excalidrawApi.getAppState();

        if (pointer) return { center: viewportCoordsToSceneCoords(pointer, appState) };

        const [minX, minY, maxX, maxY] = getVisibleSceneBounds(appState);
        return { center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 } };
    };

    const createIcon = async ({ set, name }: IconItem) => {
        const image = await IconImageStore.getIconImage(set, name);
        const scale = ICON_SIZE / Math.max(image.width, image.height);
        const file = FileUtil.createImageFile({ data: image.dataUrl, mimeType: "image/svg+xml" });
        const element = ElementCreationUtil.createImage({
            base: { x: 0, y: 0, width: image.width * scale, height: image.height * scale },
            fileId: file.id,
        });
        return { elements: [element] as ExcalidrawElements, file };
    };

    const createElement = async ({ shape }: ElementItem) => {
        if (shape.type === "markdown") {
            const { element, file } = await MarkdownNote.create();
            return { elements: [element] as ExcalidrawElements, file };
        }
        if (shape.type === "table") {
            const { element, file } = await Table.create();
            return { elements: [element] as ExcalidrawElements, file };
        }
        return {
            elements:
                shape.type === "swimlane"
                    ? SwimlaneLayout.create()
                    : ElementCreationUtil.createElementFromType(shape.type, { x: 0, y: 0 }),
            file: undefined,
        };
    };

    /** Adds the item and selects it. Returns what was added. */
    const insert = async (item: ElementItem | IconItem, placement: Placement) => {
        if (!excalidrawApi) return undefined;

        const created = item.kind === "icon" ? await createIcon(item) : await createElement(item);
        const elements = FrameUtil.addToFrame(
            placeElements(created.elements, placement),
            excalidrawApi.getSceneElements()
        );
        // A swimlane is selected as a whole, by its frame
        const { updatedState } = ElementUtil.createNewElementSelection(
            elements.filter(element => !SwimlaneLayout.isPart(element)),
            excalidrawApi.getAppState()
        );

        if (created.file) excalidrawApi.addFiles([created.file]);
        excalidrawApi.updateScene({
            elements: [...excalidrawApi.getSceneElements(), ...elements],
            appState: updatedState,
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });

        return {
            bounds: ExcalidrawUtil.getCommonBounds(elements) as Bounds,
            codeBlock: elements.find(CustomDataUtil.isCodeBlockElement),
            markdownNote: elements.find(CustomDataUtil.isMarkdownNote),
            table: elements.find(CustomDataUtil.isTable),
        };
    };

    return { getStartPlacement, insert };
};
