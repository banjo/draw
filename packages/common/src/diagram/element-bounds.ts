import { ExcalidrawElement } from "../model/excalidraw-element";
import { Box, ElementFactory } from "./element-factory";

/** Where an element is, with an arrow's or a line's points; rotation is left out */
const getBox = (element: ExcalidrawElement): Box => {
    if (ElementFactory.isLinear(element)) {
        const xs = element.points.map(([x]) => element.x + x);
        const ys = element.points.map(([, y]) => element.y + y);
        const x = Math.min(...xs);
        const y = Math.min(...ys);
        return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
    }
    return { x: element.x, y: element.y, width: element.width, height: element.height };
};

/** The box around all the elements: minX, minY, maxX, maxY, like Excalidraw's */
const getCommonBounds = (elements: readonly ExcalidrawElement[]) => {
    const boxes = elements.map(getBox);
    if (boxes.length === 0) return [0, 0, 0, 0] as const;
    return [
        Math.min(...boxes.map(box => box.x)),
        Math.min(...boxes.map(box => box.y)),
        Math.max(...boxes.map(box => box.x + box.width)),
        Math.max(...boxes.map(box => box.y + box.height)),
    ] as const;
};

export const ElementBounds = { getBox, getCommonBounds };
