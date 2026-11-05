import { toMilliseconds } from "@banjoanton/utils";
import { createHash, randomBytes } from "node:crypto";
import { McpTokenRepository } from "../repositories/mcp-token-repository";

const PREFIX = "bdmcp_";
// lastUsedAt is updated at most this often, so each call doesn't write to the database
const TOUCH_EVERY = toMilliseconds({ minutes: 1 });

export const hashMcpToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** A new raw token and its hash. Only the hash is kept. */
const generate = () => {
    const token = `${PREFIX}${randomBytes(32).toString("base64url")}`;
    return { token, tokenHash: hashMcpToken(token) };
};

export type McpAuthResult =
    { success: true; userId: number } | { success: false; status: 401 | 403; message: string };

/** The user a bearer token signs in, if it's active and the user is Pro right now */
const authenticate = async (authorization: string | undefined): Promise<McpAuthResult> => {
    const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token?.startsWith(PREFIX)) {
        return { success: false, status: 401, message: "Missing or invalid MCP token" };
    }

    const found = await McpTokenRepository.findActiveByHash(hashMcpToken(token));
    if (!found) return { success: false, status: 401, message: "Missing or invalid MCP token" };
    if (found.user.plan !== "pro") {
        return { success: false, status: 403, message: "MCP is part of Pro" };
    }

    if (!found.lastUsedAt || Date.now() - found.lastUsedAt.getTime() > TOUCH_EVERY) {
        void McpTokenRepository.touch(found.id);
    }
    return { success: true, userId: found.userId };
};

export const McpTokenService = { generate, authenticate };
