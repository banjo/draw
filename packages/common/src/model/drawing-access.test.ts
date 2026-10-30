import { describe, expect, it } from "vitest";
import { DrawingAccess } from "./drawing-access";

const OWNER = 1;
const OTHER = 2;

describe("roleFor", () => {
    it("lets the owner edit, whatever the link allows", () => {
        for (const linkAccess of ["edit", "view", "private"] as const) {
            expect(DrawingAccess.roleFor({ ownerId: OWNER, linkAccess }, OWNER)).toBe("owner");
        }
    });

    it("gives everyone else what the link allows, signed in or not", () => {
        for (const userId of [OTHER, undefined]) {
            const roleWith = (linkAccess: "edit" | "view" | "private") =>
                DrawingAccess.roleFor({ ownerId: OWNER, linkAccess }, userId);
            expect(roleWith("edit")).toBe("editor");
            expect(roleWith("view")).toBe("viewer");
            expect(roleWith("private")).toBe("none");
        }
    });

    it("lets anyone edit a drawing without an owner", () => {
        expect(DrawingAccess.roleFor({ ownerId: null, linkAccess: "private" })).toBe("editor");
        expect(DrawingAccess.roleFor({ ownerId: null, linkAccess: "view" }, OTHER)).toBe("editor");
    });
});

describe("canView and canEdit", () => {
    it("matches each role", () => {
        expect(
            ["owner", "editor", "viewer", "none"].map(r => DrawingAccess.canView(r as never))
        ).toEqual([true, true, true, false]);
        expect(
            ["owner", "editor", "viewer", "none"].map(r => DrawingAccess.canEdit(r as never))
        ).toEqual([true, true, false, false]);
    });
});
