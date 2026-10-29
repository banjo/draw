import { ExcalidrawUtil } from "@/features/draw/utils/excalidraw-util";
import { ExcalidrawElement, ExcalidrawElements } from "common";

const isFrame = (element: ExcalidrawElement) =>
    element.type === "frame" || element.type === "magicframe";

/** The top frame, like a swimlane, that the elements are all inside of */
const findFrameAround = (elements: ExcalidrawElements, sceneElements: ExcalidrawElements) => {
    if (elements.length === 0 || elements.some(isFrame)) return undefined;
    const [minX, minY, maxX, maxY] = ExcalidrawUtil.getCommonBounds(elements);

    return sceneElements.findLast(
        frame =>
            isFrame(frame) &&
            !frame.isDeleted &&
            minX >= frame.x &&
            minY >= frame.y &&
            maxX <= frame.x + frame.width &&
            maxY <= frame.y + frame.height
    );
};

/**
 * Puts elements added inside a frame in it, as Excalidraw does with shapes drawn there, so
 * they move with it. Elements partly outside are left out, as a frame hides what sticks out.
 */
const addToFrame = (elements: ExcalidrawElements, sceneElements: ExcalidrawElements) => {
    const frame = findFrameAround(elements, sceneElements);
    if (!frame) return elements;
    return elements.map(element => ({ ...element, frameId: element.frameId ?? frame.id }));
};

export const FrameUtil = { addToFrame };
