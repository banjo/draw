export type McpClientId = "claude-code" | "opencode" | "codex";

type McpClient = {
    id: McpClientId;
    label: string;
    /** Where the snippet goes */
    hint: string;
    getSnippet: (url: string, token: string) => string;
};

export const MCP_CLIENTS: McpClient[] = [
    {
        id: "claude-code",
        label: "Claude Code",
        hint: "Run in a terminal",
        getSnippet: (url, token) =>
            `claude mcp add --transport http banjodraw ${url} --header "Authorization: Bearer ${token}"`,
    },
    {
        id: "opencode",
        label: "opencode",
        hint: "Add to opencode.json",
        getSnippet: (url, token) =>
            JSON.stringify(
                {
                    mcp: {
                        banjodraw: {
                            type: "remote",
                            url,
                            headers: { Authorization: `Bearer ${token}` },
                        },
                    },
                },
                null,
                2
            ),
    },
    {
        id: "codex",
        label: "Codex",
        hint: "Add to ~/.codex/config.toml",
        getSnippet: (url, token) =>
            `[mcp_servers.banjodraw]\nurl = "${url}"\nhttp_headers = { "Authorization" = "Bearer ${token}" }`,
    },
];

/** Shown in snippets until a token is made */
export const TOKEN_PLACEHOLDER = "<your token>";
