import { placeElements, Placement } from "@/features/add-element/hooks/use-insert-element";
import { ElementCreationUtil } from "@/features/draw/utils/element-creation-util";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { ExcalidrawUtil } from "@/features/draw/utils/excalidraw-util";
import { FileUtil } from "@/features/draw/utils/file-util";
import { FrameUtil } from "@/features/draw/utils/frame-util";
import { UpdateElementUtil } from "@/features/draw/utils/update-element-util";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { BinaryFileData } from "@excalidraw/excalidraw/types";
import { Mutable } from "@excalidraw/excalidraw/utility-types";
import {
    CustomData,
    ExcalidrawApi,
    ExcalidrawElement,
    ExcalidrawElements,
    ExcalidrawImageElement,
} from "common";
import { MermaidRenderer } from "./mermaid-renderer";
import { MermaidMode } from "../stores/use-mermaid-dialog-store";

type Created = { elements: ExcalidrawElements; files: BinaryFileData[] };

const getDefinition = (element: ExcalidrawElement) =>
    CustomData.getMermaidDefinition(element.customData) ?? "";

/** A Mermaid block: an image of the diagram, saved like any other, with the diagram on it */
const createBlock = async (definition: string): Promise<Created> => {
    const image = await MermaidRenderer.renderImage(definition);
    const file = FileUtil.createImageFile({ data: image.dataURL, mimeType: "image/svg+xml" });
    const element = ElementCreationUtil.createImage({
        base: { x: 0, y: 0, width: image.width, height: image.height },
        fileId: file.id,
        callback: draft => {
            draft.customData = CustomData.createMermaid(definition);
            return draft;
        },
    });
    return { elements: [element] as ExcalidrawElements, files: [file] };
};

const createShapes = async (definition: string): Promise<Created> => {
    const { elements, files } = await MermaidRenderer.renderShapes(definition);
    return { elements, files: Object.values(files) };
};

/** Diagrams that can't become shapes are added as a block, which looks better than an image */
const isShapes = (definition: string, mode: MermaidMode) =>
    mode === "shapes" && MermaidRenderer.canBeShapes(definition);

const create = (definition: string, mode: MermaidMode) =>
    isShapes(definition, mode) ? createShapes(definition) : createBlock(definition);

/** Adds the created elements and selects them */
const add = (api: ExcalidrawApi, elements: ExcalidrawElements, created: Created) => {
    const { updatedState } = ElementUtil.createNewElementSelection(
        created.elements,
        api.getAppState()
    );
    if (created.files.length > 0) api.addFiles(created.files);
    api.updateScene({
        elements: [...elements, ...created.elements],
        appState: updatedState,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
};

type Diagram = { definition: string; mode: MermaidMode };

/** A new diagram, as shapes or a block */
const insert = async (
    api: ExcalidrawApi,
    { definition, mode, placement }: Diagram & { placement: Placement }
) => {
    const created = await create(definition, mode);
    add(api, api.getSceneElementsIncludingDeleted(), {
        ...created,
        elements: FrameUtil.addToFrame(
            placeElements(created.elements, placement),
            api.getSceneElements()
        ),
    });
};

/** The width the block's image was drawn at, to keep the size it was resized to */
const getNaturalWidth = (api: ExcalidrawApi, element: ExcalidrawImageElement) => {
    const file = element.fileId ? api.getFiles()[element.fileId] : undefined;
    const base64 = file?.dataURL.split(",")[1];
    if (!base64) return undefined;
    const match = /<svg[^>]*\swidth="([\d.]+)"/.exec(atob(base64));
    return match ? Number(match[1]) : undefined;
};

/** A new diagram for a block, or the block turned into shapes in its place */
const update = async (api: ExcalidrawApi, { id, definition, mode }: Diagram & { id: string }) => {
    const created = await create(definition, mode);

    // Read after drawing, as the drawing may have changed meanwhile
    const elements = api.getSceneElementsIncludingDeleted();
    const block = elements.find(element => element.id === id && !element.isDeleted);
    if (!block || !ExcalidrawUtil.isImageElement(block)) return;

    if (isShapes(definition, mode)) {
        const center = { x: block.x + block.width / 2, y: block.y + block.height / 2 };
        // Marked as deleted, instead of left out, so the deletion reaches the server
        add(api, ElementUtil.deleteElements(elements, [id]), {
            ...created,
            elements: FrameUtil.addToFrame(
                placeElements(created.elements, { center }),
                api.getSceneElements()
            ),
        });
        return;
    }

    const [image] = created.elements;
    if (!image || !ExcalidrawUtil.isImageElement(image)) return;
    const scale = block.width / (getNaturalWidth(api, block) ?? block.width);
    const updated = UpdateElementUtil.updateElement(block, draft => {
        (draft as Mutable<ExcalidrawImageElement>).fileId = image.fileId;
        draft.width = image.width * scale;
        draft.height = image.height * scale;
        draft.customData = CustomData.createMermaid(definition);
        return draft;
    });

    api.addFiles(created.files);
    api.updateScene({
        elements: ElementUtil.mergeElements(elements, [updated]),
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
};

export const MermaidBlock = { getDefinition, insert, update };
