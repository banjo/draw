import { describe, expect, it } from "vitest";
import { DeltaUpdateUtil } from "./delta-update-util";

type TestElement = {
    id: string;
    version: number;
    versionNonce: number;
    isDeleted: boolean;
    label?: string;
};

const element = (id: string, version = 1, props: Partial<TestElement> = {}): TestElement => ({
    id,
    version,
    versionNonce: 100,
    isDeleted: false,
    ...props,
});

const ids = (elements: TestElement[]) => elements.map(e => e.id);

describe("mergeElements", () => {
    it("keeps elements that are missing from the incoming order", () => {
        // B's order was made before it received X from someone else
        const { elements } = DeltaUpdateUtil.mergeElements({
            elements: [element("a"), element("b"), element("x")],
            incoming: [element("c")],
            order: ["a", "b", "c"],
        });

        expect(ids(elements)).toEqual(["a", "b", "c", "x"]);
    });

    it("adds new elements when there is no order", () => {
        const { elements } = DeltaUpdateUtil.mergeElements({
            elements: [element("a")],
            incoming: [element("b")],
        });

        expect(ids(elements)).toEqual(["a", "b"]);
    });

    it("sorts by the order and ignores unknown or repeated ids", () => {
        const { elements } = DeltaUpdateUtil.mergeElements({
            elements: [element("a"), element("b"), element("c")],
            incoming: [],
            order: ["c", "unknown", "a", "c"],
        });

        expect(ids(elements)).toEqual(["c", "a", "b"]);
    });

    it("takes the higher version and ignores older copies", () => {
        const current = [element("a", 3, { label: "current" })];

        const newer = DeltaUpdateUtil.mergeElements({
            elements: current,
            incoming: [element("a", 4, { label: "newer" })],
        });
        const older = DeltaUpdateUtil.mergeElements({
            elements: current,
            incoming: [element("a", 2, { label: "older" })],
        });

        expect(newer.elements[0]?.label).toBe("newer");
        expect(newer.applied).toHaveLength(1);
        expect(older.elements[0]?.label).toBe("current");
        expect(older.applied).toHaveLength(0);
    });

    it("picks the same copy on every side when versions tie", () => {
        const low = element("a", 2, { versionNonce: 1, label: "low" });
        const high = element("a", 2, { versionNonce: 9, label: "high" });

        const onOneSide = DeltaUpdateUtil.mergeElements({ elements: [high], incoming: [low] });
        const onOtherSide = DeltaUpdateUtil.mergeElements({ elements: [low], incoming: [high] });

        expect(onOneSide.elements[0]?.label).toBe("low");
        expect(onOtherSide.elements[0]?.label).toBe("low");
    });

    it("keeps deleted elements, so an older copy can't bring them back", () => {
        const deleted = DeltaUpdateUtil.mergeElements({
            elements: [element("a", 1)],
            incoming: [element("a", 2, { isDeleted: true })],
        });
        const stale = DeltaUpdateUtil.mergeElements({
            elements: deleted.elements,
            incoming: [element("a", 1)],
        });

        expect(stale.elements).toEqual([element("a", 2, { isDeleted: true })]);
    });

    it("leaves elements alone that the user is changing", () => {
        const { elements, applied } = DeltaUpdateUtil.mergeElements({
            elements: [element("a", 1, { label: "typing" })],
            incoming: [element("a", 5, { label: "remote" })],
            keep: id => id === "a",
        });

        expect(elements[0]?.label).toBe("typing");
        expect(applied).toHaveLength(0);
    });

    it("matches numeric and string ids", () => {
        const { elements } = DeltaUpdateUtil.mergeElements({
            elements: [{ ...element("1"), id: 1 as unknown as string }],
            incoming: [element("1", 2, { label: "updated" })],
            order: ["1"],
        });

        expect(elements).toHaveLength(1);
        expect(elements[0]?.label).toBe("updated");
    });
});

describe("applyToBoard", () => {
    it("applies a change without dropping the rest of the board", () => {
        const board = { elements: [element("a"), element("b")] };

        const updated = DeltaUpdateUtil.applyToBoard({
            board,
            deltaUpdate: {
                excalidrawElements: [element("a", 2, { label: "moved" })],
                order: ["a"],
            },
        });

        expect(ids(updated.elements as TestElement[])).toEqual(["a", "b"]);
        expect((updated.elements[0] as TestElement).label).toBe("moved");
    });
});
