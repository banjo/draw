import { describe, expect, it } from "vitest";
import { isWithin } from "./folder-tree";

// 1 > 2 > 3, and 4 at the top level
const parents = new Map<number, number | null>([
    [1, null],
    [2, 1],
    [3, 2],
    [4, null],
]);

describe("isWithin", () => {
    it("is true for the folder itself and anything inside it", () => {
        expect(isWithin(1, 1, parents)).toBe(true);
        expect(isWithin(2, 1, parents)).toBe(true);
        expect(isWithin(3, 1, parents)).toBe(true);
    });

    it("is false for parents and unrelated folders", () => {
        expect(isWithin(1, 3, parents)).toBe(false);
        expect(isWithin(4, 1, parents)).toBe(false);
        expect(isWithin(99, 1, parents)).toBe(false);
    });

    it("stops on a loop in the data", () => {
        const loop = new Map<number, number | null>([
            [1, 2],
            [2, 1],
        ]);
        expect(isWithin(1, 3, loop)).toBe(false);
    });
});
