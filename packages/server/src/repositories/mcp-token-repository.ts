import { prisma } from "db";

/** Tokens a user can have at a time */
export const MAX_MCP_TOKENS = 20;

const listActive = (userId: number) =>
    prisma.mcpToken.findMany({
        where: { userId, revokedAt: null },
        select: { id: true, name: true, createdAt: true, lastUsedAt: true },
        orderBy: { createdAt: "desc" },
    });

const countActive = (userId: number) =>
    prisma.mcpToken.count({ where: { userId, revokedAt: null } });

const create = (userId: number, name: string, tokenHash: string) =>
    prisma.mcpToken.create({
        data: { userId, name, tokenHash },
        select: { id: true, name: true, createdAt: true, lastUsedAt: true },
    });

/** Revokes a user's token. False if the user has no such active token. */
const revoke = async (userId: number, id: string) => {
    const { count } = await prisma.mcpToken.updateMany({
        where: { id, userId, revokedAt: null },
        data: { revokedAt: new Date() },
    });
    return count > 0;
};

/** An active token by its hash, with its user's plan */
const findActiveByHash = (tokenHash: string) =>
    prisma.mcpToken.findFirst({
        where: { tokenHash, revokedAt: null },
        select: { id: true, userId: true, lastUsedAt: true, user: { select: { plan: true } } },
    });

const touch = (id: string) =>
    prisma.mcpToken
        .update({ where: { id }, data: { lastUsedAt: new Date() } })
        .catch(() => undefined);

export const McpTokenRepository = {
    listActive,
    countActive,
    create,
    revoke,
    findActiveByHash,
    touch,
};
