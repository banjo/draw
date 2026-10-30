import { Result } from "common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DrawRepository } from "../repositories/draw-repository";
import { AccessService } from "./access-service";

vi.mock("../lib/context-logger", () => {
    const noop = () => {};
    const logger = { trace: noop, debug: noop, info: noop, warn: noop, error: noop, fatal: noop };
    return { createContextLogger: () => logger };
});

vi.mock("../repositories/draw-repository", () => ({
    DrawRepository: {
        getAccessSettings: vi.fn(),
        updateLinkAccess: vi.fn(),
    },
}));

const getAccessSettings = vi.mocked(DrawRepository.getAccessSettings);
const updateLinkAccess = vi.mocked(DrawRepository.updateLinkAccess);

const OWNER = 1;
const OTHER = 2;

beforeEach(() => {
    vi.useFakeTimers();
    AccessService.clearCache();
    getAccessSettings
        .mockReset()
        .mockResolvedValue(Result.ok({ ownerId: OWNER, linkAccess: "edit" as const }));
    updateLinkAccess.mockReset().mockResolvedValue(Result.ok());
});

afterEach(() => {
    vi.useRealTimers();
});

const roleOf = async (userId?: number) => {
    const role = await AccessService.getRole("s", userId);
    if (!role.success) throw new Error(role.message);
    return role.data;
};

describe("getRole", () => {
    it("is undefined for a drawing that doesn't exist", async () => {
        getAccessSettings.mockResolvedValue(Result.ok(undefined));
        expect(await roleOf(OWNER)).toBeUndefined();
    });

    it("asks the database once for many changes in a row", async () => {
        await roleOf(OTHER);
        await roleOf(OTHER);
        await roleOf(OWNER);
        expect(getAccessSettings).toHaveBeenCalledTimes(1);
    });

    it("asks the database again after a while", async () => {
        await roleOf(OTHER);
        vi.advanceTimersByTime(6 * 60 * 1000);
        await roleOf(OTHER);
        expect(getAccessSettings).toHaveBeenCalledTimes(2);
    });
});

describe("setLinkAccess", () => {
    it("only lets the owner change it", async () => {
        const result = await AccessService.setLinkAccess("s", OTHER, "private");
        expect(result.success).toBe(false);
        expect(updateLinkAccess).not.toHaveBeenCalled();
    });

    it("can't change a drawing without an owner", async () => {
        getAccessSettings.mockResolvedValue(
            Result.ok({ ownerId: null, linkAccess: "edit" as const })
        );
        const result = await AccessService.setLinkAccess("s", OWNER, "private");
        expect(result.success).toBe(false);
    });

    it("changes the role of everyone else right away", async () => {
        expect(await roleOf(OTHER)).toBe("editor");
        await AccessService.setLinkAccess("s", OWNER, "view");
        expect(await roleOf(OTHER)).toBe("viewer");
        expect(await roleOf(OWNER)).toBe("owner");
    });

    it("tells listeners the role they have now", async () => {
        const otherRoles: string[] = [];
        const ownerRoles: string[] = [];
        const stop = AccessService.onRoleChange("s", OTHER, role => otherRoles.push(role));
        AccessService.onRoleChange("s", OWNER, role => ownerRoles.push(role));
        AccessService.onRoleChange("another", OTHER, () => otherRoles.push("wrong drawing"));

        await AccessService.setLinkAccess("s", OWNER, "view");
        await AccessService.setLinkAccess("s", OWNER, "private");
        stop();
        await AccessService.setLinkAccess("s", OWNER, "edit");

        expect(otherRoles).toEqual(["viewer", "none"]);
        expect(ownerRoles).toEqual(["owner", "owner", "owner"]);
    });

    it("keeps the old access when the database fails", async () => {
        updateLinkAccess.mockResolvedValue(Result.error("down"));
        const result = await AccessService.setLinkAccess("s", OWNER, "private");
        expect(result.success).toBe(false);
        expect(await roleOf(OTHER)).toBe("editor");
    });
});
