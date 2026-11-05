import { TRPCError } from "@trpc/server";
import { McpTokenCreateInput, McpTokenRevokeInput } from "common";
import { AiRepository } from "../../repositories/ai-repository";
import { MAX_MCP_TOKENS, McpTokenRepository } from "../../repositories/mcp-token-repository";
import { McpTokenService } from "../../services/mcp-token-service";
import { createTRPCRouter, protectedProcedure } from "../trpc";

/** MCP is part of Pro */
const proProcedure = protectedProcedure.use(async ({ ctx, next }) => {
    const plan = await AiRepository.getPlan(ctx.session.userId);
    if (plan !== "pro") {
        throw new TRPCError({ code: "FORBIDDEN", message: "MCP is part of Pro" });
    }
    return next();
});

export const mcpRouter = createTRPCRouter({
    /** The active tokens, without the tokens themselves */
    listTokens: proProcedure.query(({ ctx }) => McpTokenRepository.listActive(ctx.session.userId)),

    /** A new token, which is only shown this once */
    createToken: proProcedure.input(McpTokenCreateInput).mutation(async ({ ctx, input }) => {
        const { userId } = ctx.session;
        if ((await McpTokenRepository.countActive(userId)) >= MAX_MCP_TOKENS) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: `You can have ${MAX_MCP_TOKENS} tokens. Revoke one first.`,
            });
        }
        const { token, tokenHash } = McpTokenService.generate();
        const created = await McpTokenRepository.create(userId, input.name, tokenHash);
        return { ...created, token };
    }),

    revokeToken: proProcedure.input(McpTokenRevokeInput).mutation(async ({ ctx, input }) => {
        const isRevoked = await McpTokenRepository.revoke(ctx.session.userId, input.id);
        if (!isRevoked) throw new TRPCError({ code: "NOT_FOUND", message: "Token not found" });
    }),
});
