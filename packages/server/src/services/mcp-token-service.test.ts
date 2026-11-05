import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpTokenRepository } from "../repositories/mcp-token-repository";
import { hashMcpToken, McpTokenService } from "./mcp-token-service";

vi.mock("../repositories/mcp-token-repository", () => ({
    McpTokenRepository: { findActiveByHash: vi.fn(), touch: vi.fn() },
}));

const findActiveByHash = vi.mocked(McpTokenRepository.findActiveByHash);
const touch = vi.mocked(McpTokenRepository.touch);

type Found = Awaited<ReturnType<typeof McpTokenRepository.findActiveByHash>>;
const token = (plan: "free" | "pro", lastUsedAt: Date | null = null): Found => ({
    id: "token",
    userId: 7,
    lastUsedAt,
    user: { plan },
});

beforeEach(() => {
    findActiveByHash.mockReset();
    touch.mockReset().mockResolvedValue(undefined);
});

describe("McpTokenService", () => {
    it("makes tokens that are only kept as a hash", () => {
        const { token: raw, tokenHash } = McpTokenService.generate();
        expect(raw).toMatch(/^bdmcp_[\w-]{43}$/);
        expect(tokenHash).toBe(hashMcpToken(raw));
        expect(tokenHash).not.toContain(raw);
    });

    it("signs in the token's user when they're Pro", async () => {
        findActiveByHash.mockResolvedValue(token("pro"));
        const result = await McpTokenService.authenticate("Bearer bdmcp_abc");
        expect(result).toEqual({ success: true, userId: 7 });
        expect(findActiveByHash).toHaveBeenCalledWith(hashMcpToken("bdmcp_abc"));
        expect(touch).toHaveBeenCalledWith("token");
    });

    it("refuses missing, malformed, unknown and revoked tokens", async () => {
        findActiveByHash.mockResolvedValue(null);
        for (const header of [undefined, "bdmcp_abc", "Bearer other", "Bearer bdmcp_abc"]) {
            expect(await McpTokenService.authenticate(header)).toMatchObject({
                success: false,
                status: 401,
            });
        }
    });

    it("refuses a token once its user isn't Pro", async () => {
        findActiveByHash.mockResolvedValue(token("free"));
        expect(await McpTokenService.authenticate("Bearer bdmcp_abc")).toMatchObject({
            success: false,
            status: 403,
        });
    });

    it("notes when a token was used at most once a minute", async () => {
        findActiveByHash.mockResolvedValue(token("pro", new Date()));
        await McpTokenService.authenticate("Bearer bdmcp_abc");
        expect(touch).not.toHaveBeenCalled();
    });
});
