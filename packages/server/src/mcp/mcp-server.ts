import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
    DIAGRAM_FORMAT_GUIDE,
    McpCreateDiagramInput,
    McpGetDiagramInput,
    McpUpdateDiagramInput,
} from "common";
import { Request, Response } from "express";
import { createContextLogger } from "../lib/context-logger";
import { NodeContext } from "../lib/node-context";
import { McpDiagramService, McpToolError } from "../services/mcp-diagram-service";
import { McpTokenService } from "../services/mcp-token-service";

const logger = createContextLogger("mcp");

const INSTRUCTIONS = `BanjoDraw is a whiteboard app built on Excalidraw. These tools read and change the user's drawings as diagrams: nodes, edges and groups, which BanjoDraw lays out and draws. You never give positions or sizes.

${DIAGRAM_FORMAT_GUIDE}

- Ids you pick for new nodes and groups are short and readable, like "api". The output maps them to the ids they got in the drawing; use those from then on, and get_diagram's ids for what was there.
- update_diagram changes only what you name; everything else, also what a diagram can't hold like drawings and images, stays where it is. Prefer it over making a new drawing.
- Drawings can't be deleted here. Open appUrl to see a drawing; only its owner can, unless it's shared.`;

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

/** The tool's answer as JSON, or a message the client can act on */
const run = async (tool: string, fn: () => Promise<unknown>): Promise<ToolResult> => {
    try {
        const result = await fn();
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
        if (error instanceof McpToolError) {
            return { content: [{ type: "text", text: error.message }], isError: true };
        }
        logger.error({ error, tool }, "MCP tool failed");
        return {
            content: [{ type: "text", text: "Something went wrong. Try again." }],
            isError: true,
        };
    }
};

/** A server for one request, with tools for the user the token belongs to */
const createServer = (userId: number) => {
    const server = new McpServer(
        { name: "banjodraw", version: "1.0.0" },
        { instructions: INSTRUCTIONS }
    );

    server.registerTool(
        "list_diagrams",
        {
            title: "List drawings",
            description:
                "The user's drawings, last changed first: slug, name, appUrl and updatedAt.",
            annotations: { readOnlyHint: true },
        },
        () => run("list_diagrams", () => McpDiagramService.list(userId))
    );

    server.registerTool(
        "get_diagram",
        {
            title: "Get a drawing",
            description:
                "A drawing as a diagram: groups, nodes (with box, where each one is) and edges, with the ids to change them by. `other` counts what a diagram can't hold, like drawings and images, which update_diagram leaves alone.",
            inputSchema: McpGetDiagramInput.shape,
            annotations: { readOnlyHint: true },
        },
        ({ slug }) => run("get_diagram", () => McpDiagramService.get(userId, slug))
    );

    server.registerTool(
        "create_diagram",
        {
            title: "Create a drawing",
            description:
                "Makes a new private drawing in the user's collection from a diagram, laid out by BanjoDraw. Returns its slug, appUrl, and the ids your nodes and groups got.",
            inputSchema: McpCreateDiagramInput.shape,
        },
        input => run("create_diagram", () => McpDiagramService.create(userId, input))
    );

    server.registerTool(
        "update_diagram",
        {
            title: "Change a drawing",
            description:
                "Adds, changes and removes nodes, edges and groups by id, and can rename the drawing. Everything else stays where it is; new nodes go next to what they're connected to. Shows up right away for anyone who has the drawing open. Unknown ids change nothing.",
            inputSchema: McpUpdateDiagramInput.shape,
            annotations: { destructiveHint: true },
        },
        input => run("update_diagram", () => McpDiagramService.update(userId, input))
    );

    return server;
};

const sendError = (res: Response, status: number, message: string) => {
    res.status(status).json({ jsonrpc: "2.0", error: { code: -32000, message }, id: null });
};

/**
 * The MCP endpoint, over Streamable HTTP without sessions: every request is signed in with
 * its bearer token and gets a server of its own.
 */
export const handleMcpRequest = async (req: Request, res: Response) => {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        sendError(res, 405, "Method not allowed");
        return;
    }

    const auth = await McpTokenService.authenticate(req.headers.authorization);
    if (!auth.success) {
        if (auth.status === 401) res.setHeader("WWW-Authenticate", 'Bearer realm="BanjoDraw MCP"');
        sendError(res, auth.status, auth.message);
        return;
    }
    NodeContext.setUserId(auth.userId);

    const server = createServer(auth.userId);
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
    });
    res.on("close", () => {
        void transport.close();
        void server.close();
    });

    try {
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    } catch (error) {
        logger.error({ error }, "MCP request failed");
        if (!res.headersSent) sendError(res, 500, "Internal server error");
    }
};
