import { ElementCreationUtil } from "@/features/draw/utils/element-creation-util";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { UpdateElementUtil } from "@/features/draw/utils/update-element-util";
import { Mutable } from "@excalidraw/excalidraw/utility-types";
import {
    CustomData,
    CustomDataSwimlane,
    CustomDataSwimlanePart,
    ExcalidrawElement,
    ExcalidrawElements,
    ExcalidrawLinearElement,
    ExcalidrawTextElement,
    SwimlanePart,
} from "common";

/** The column with the lanes' names */
export const HEADER_WIDTH = 140;
const LANE_HEIGHT = 170;
const WIDTH = 960;
const DEFAULT_LANES = 3;
export const MIN_LANES = 1;
export const MAX_LANES = 12;
const LABEL_PADDING = 10;
const LABEL_FONT_SIZE = 20;
// Like the frame's own outline
const LINE_COLOR = "#bbb";
// Excalidraw's palest colors, one after the other
const TINTS = ["#e7f5ff", "#ebfbee", "#fff9db", "#fff0f6", "#f3f0ff", "#fff4e6"];

type Box = { x: number; y: number; width: number; height: number };

const getSwimlane = (element: ExcalidrawElement) =>
    element.type === "frame" && element.customData?.type === "swimlane"
        ? (element.customData as CustomDataSwimlane)
        : undefined;

const getPart = (element: ExcalidrawElement) =>
    element.customData?.type === "swimlane-part"
        ? (element.customData as CustomDataSwimlanePart)
        : undefined;

const isSwimlane = (element: ExcalidrawElement) => getSwimlane(element) !== undefined;
const isPart = (element: ExcalidrawElement) => getPart(element) !== undefined;

const getLaneCount = (frame: ExcalidrawElement) =>
    Math.min(Math.max(getSwimlane(frame)?.lanes ?? 1, MIN_LANES), MAX_LANES);

/** Where a part goes in its swimlane, or undefined for one it doesn't have */
const getBox = (frame: ExcalidrawElement, part: SwimlanePart, lane: number): Box | undefined => {
    const lanes = getLaneCount(frame);
    if (lane < 0 || lane >= lanes) return undefined;

    const laneHeight = frame.height / lanes;
    const top = frame.y + lane * laneHeight;

    switch (part) {
        case "tint": {
            return { x: frame.x, y: top, width: frame.width, height: laneHeight };
        }
        case "line": {
            return lane > 0 ? { x: frame.x, y: top, width: frame.width, height: 0 } : undefined;
        }
        case "divider": {
            return lane === 0
                ? { x: frame.x + HEADER_WIDTH, y: frame.y, width: 0, height: frame.height }
                : undefined;
        }
        case "label": {
            const width = Math.max(HEADER_WIDTH - LABEL_PADDING * 2, 1);
            return { x: frame.x + LABEL_PADDING, y: top, width, height: laneHeight };
        }
    }
};

/** The parts every swimlane has; labels are only made with a lane, as people can remove them */
const getDrawnParts = (frame: ExcalidrawElement) => {
    const lanes = getLaneCount(frame);
    const parts: { part: SwimlanePart; lane: number }[] = [];
    for (let lane = 0; lane < lanes; lane++) parts.push({ part: "tint", lane });
    for (let lane = 1; lane < lanes; lane++) parts.push({ part: "line", lane });
    // Over the tints, which would hide it
    parts.push({ part: "divider", lane: 0 });
    return parts;
};

const partData = (
    swimlaneId: string,
    part: SwimlanePart,
    lane: number
): CustomDataSwimlanePart => ({
    shadow: false,
    type: "swimlane-part",
    swimlaneId,
    part,
    lane,
});

const isSame = (a: number, b: number) => Math.abs(a - b) < 0.01;

const isPlaced = (element: ExcalidrawElement, { x, y, width, height }: Box) =>
    isSame(element.x, x) &&
    isSame(element.y, y) &&
    isSame(element.width, width) &&
    isSame(element.height, height);

/** The part where it belongs, shown, and in its swimlane; undefined when it already is */
const place = (
    element: ExcalidrawElement,
    frame: ExcalidrawElement,
    box: Box
): ExcalidrawElement | undefined => {
    const part = getPart(element)!;
    const isLabel = part.part === "label";
    const target = isLabel
        ? { ...box, y: box.y + (box.height - element.height) / 2, height: element.height }
        : box;

    const isRight =
        isPlaced(element, target) &&
        !element.isDeleted &&
        !part.hidden &&
        element.frameId === frame.id &&
        part.swimlaneId === frame.id &&
        element.locked === !isLabel;
    if (isRight) return undefined;

    return UpdateElementUtil.updateElement(element, draft => {
        draft.x = target.x;
        draft.y = target.y;
        draft.width = target.width;
        draft.height = target.height;
        draft.isDeleted = false;
        draft.frameId = frame.id;
        draft.locked = !isLabel;
        draft.customData = { ...part, swimlaneId: frame.id, hidden: undefined };
        if (part.part === "line" || part.part === "divider") {
            (draft as Mutable<ExcalidrawLinearElement>).points = [
                [0, 0],
                [target.width, target.height],
            ];
        }
        return draft;
    });
};

const createPart = (
    frame: ExcalidrawElement,
    part: SwimlanePart,
    lane: number,
    box: Box
): ExcalidrawElement => {
    const finish = (draft: Mutable<ExcalidrawElement>) => {
        draft.customData = partData(frame.id, part, lane);
        draft.frameId = frame.id;
        draft.locked = true;
        draft.roughness = 0;
        return draft;
    };

    if (part === "tint") {
        return ElementCreationUtil.createElement({
            base: { type: "rectangle", ...box },
            props: {
                backgroundColor: TINTS[lane % TINTS.length],
                fillStyle: "solid",
                strokeColor: "transparent",
                roundness: null,
            },
            callback: finish,
        });
    }

    return ElementCreationUtil.createLinearElement(
        {
            type: "line",
            x: box.x,
            y: box.y,
            points: [
                [0, 0],
                [box.width, box.height],
            ],
        },
        draft => {
            draft.strokeColor = LINE_COLOR;
            draft.strokeWidth = 1;
            return finish(draft) as ExcalidrawLinearElement;
        }
    );
};

const createLabel = (frame: ExcalidrawElement, lane: number) => {
    const box = getBox(frame, "label", lane)!;
    return ElementCreationUtil.createText(
        `Lane ${lane + 1}`,
        { ...box, height: LABEL_FONT_SIZE * 1.25, fontSize: LABEL_FONT_SIZE },
        draft => {
            const text = draft as Mutable<ExcalidrawTextElement>;
            text.textAlign = "center";
            // Wraps long names at the column's width
            text.autoResize = false;
            text.width = box.width;
            draft.customData = partData(frame.id, "label", lane);
            draft.frameId = frame.id;
            return draft;
        },
        "swimlane-part"
    );
};

/** A part that isn't the swimlane's any more becomes plain text, or goes */
const release = (element: ExcalidrawElement) =>
    UpdateElementUtil.updateElement(element, draft => {
        if (getPart(element)?.part === "label") {
            draft.customData = CustomData.createDefault({ shadow: false, type: "text" });
        } else {
            draft.isDeleted = true;
        }
        return draft;
    });

const hide = (element: ExcalidrawElement) =>
    UpdateElementUtil.updateElement(element, draft => {
        draft.isDeleted = true;
        draft.customData = { ...getPart(element)!, hidden: true };
        return draft;
    });

/** Shown parts first, so a shown part wins over a deleted copy of it */
const byShown = (a: ExcalidrawElement, b: ExcalidrawElement) =>
    Number(a.isDeleted) - Number(b.isDeleted);

/**
 * Keeps every swimlane's parts where they belong, e.g. after it's resized, undone, copied or
 * deleted. Returns the elements with the changes, or undefined when nothing changed.
 * `editingId` is the text being typed in, which is left where it is meanwhile.
 */
const sync = (elements: ExcalidrawElements, editingId?: string) => {
    const frames = new Map(elements.filter(isSwimlane).map(frame => [frame.id, frame]));
    const parts = elements.filter(isPart).sort(byShown);
    if (frames.size === 0 && parts.length === 0) return undefined;

    const changed = new Map<string, ExcalidrawElement>();
    const placed = new Set<string>();

    for (const element of parts) {
        const part = getPart(element)!;
        const ownerId =
            element.frameId && frames.has(element.frameId) ? element.frameId : part.swimlaneId;
        const frame = frames.get(ownerId);
        const key = `${ownerId}:${part.part}:${part.lane}`;

        if (!frame) {
            if (!element.isDeleted) changed.set(element.id, release(element));
            continue;
        }

        if (frame.isDeleted) {
            if (!element.isDeleted) changed.set(element.id, hide(element));
            continue;
        }

        const box = getBox(frame, part.part, part.lane);
        // A copy, e.g. of a label copied on its own, or the part of a lane that was removed
        if (!box || placed.has(key)) {
            if (!element.isDeleted) changed.set(element.id, release(element));
            continue;
        }

        placed.add(key);
        // A label someone deleted stays deleted
        if (element.isDeleted && part.part === "label" && !part.hidden) continue;
        if (element.id === editingId) continue;

        const updated = place(element, frame, box);
        if (updated) changed.set(element.id, updated);
    }

    // Missing parts, e.g. a new lane's: tints below the swimlane's other parts, lines over them
    const before = new Map<string, ExcalidrawElement[]>();
    const after = new Map<string, ExcalidrawElement[]>();
    const add = (map: Map<string, ExcalidrawElement[]>, id: string, element: ExcalidrawElement) =>
        map.set(id, [...(map.get(id) ?? []), element]);

    for (const frame of frames.values()) {
        if (frame.isDeleted) continue;
        const missing = getDrawnParts(frame).filter(
            ({ part, lane }) => !placed.has(`${frame.id}:${part}:${lane}`)
        );
        if (missing.length === 0) continue;

        const own = elements.filter(
            element => getPart(element)?.swimlaneId === frame.id && !element.isDeleted
        );
        const first = own[0] ?? frame;
        const lastDrawn = own.findLast(element => getPart(element)?.part !== "label");

        for (const { part, lane } of missing) {
            const element = createPart(frame, part, lane, getBox(frame, part, lane)!);
            if (part === "tint" || !lastDrawn) add(before, first.id, element);
            else add(after, lastDrawn.id, element);
        }
    }

    if (changed.size === 0 && before.size === 0 && after.size === 0) return undefined;

    return elements.flatMap(element => [
        ...(before.get(element.id) ?? []),
        changed.get(element.id) ?? element,
        ...(after.get(element.id) ?? []),
    ]);
};

/** A new swimlane at 0,0 with its lanes, named Lane 1, Lane 2… */
const create = (): ExcalidrawElements => {
    const frame = ElementCreationUtil.createElementFromSkeleton({
        type: "frame",
        x: 0,
        y: 0,
        width: WIDTH,
        height: LANE_HEIGHT * DEFAULT_LANES,
        name: "Swimlane",
        children: [],
        customData: { shadow: false, type: "swimlane", lanes: DEFAULT_LANES },
    });

    const labels = Array.from({ length: DEFAULT_LANES }, (_, lane) => createLabel(frame, lane));
    return sync([...labels, frame]) ?? [...labels, frame];
};

/**
 * More or fewer lanes. A new lane is added at the bottom, as tall as the others; when one is
 * removed, the others grow to fill its place, so nothing in it ends up outside.
 */
const setLaneCount = (elements: ExcalidrawElements, frameId: string, lanes: number) => {
    const frame = elements.find(element => element.id === frameId && !element.isDeleted);
    const swimlane = frame && getSwimlane(frame);
    if (!frame || !swimlane) return undefined;

    const count = Math.min(Math.max(lanes, MIN_LANES), MAX_LANES);
    const current = getLaneCount(frame);
    if (count === current) return undefined;

    const laneHeight = frame.height / current;
    const updatedFrame = UpdateElementUtil.updateElement(frame, draft => {
        draft.customData = { ...swimlane, lanes: count };
        if (count > current) draft.height = laneHeight * count;
        return draft;
    });

    const labels = Array.from({ length: Math.max(count - current, 0) }, (_, i) =>
        createLabel(updatedFrame, current + i)
    );
    // The removed lanes' parts, their name too
    const removed = elements
        .filter(element => {
            const part = getPart(element);
            const isOwn = element.frameId === frameId || part?.swimlaneId === frameId;
            return part && isOwn && part.lane >= count && !element.isDeleted;
        })
        .map(element =>
            UpdateElementUtil.updateElement(element, draft => {
                draft.isDeleted = true;
                return draft;
            })
        );
    const merged = ElementUtil.mergeElements(elements, [updatedFrame, ...removed]);
    const withLabels = labels.length > 0 ? [...merged, ...labels] : merged;
    return sync(withLabels) ?? withLabels;
};

export const SwimlaneLayout = {
    create,
    sync,
    setLaneCount,
    getSwimlane,
    getLaneCount,
    isSwimlane,
    isPart,
};
