import { Modal } from "@/components/modal";
import { PlanBadge } from "@/components/plan-badge";
import { useAuth } from "@/contexts/auth-context";
import { trpc } from "@/lib/trpc";
import { BRAND_TEXT } from "@/models/brand";
import { copyToClipboard } from "@/utils/clipboard";
import { getHttpUrl } from "@/utils/runtime";
import { Check, Copy, Plug, X } from "lucide-react";
import { FormEvent, useState } from "react";
import toast from "react-hot-toast";
import { cn } from "ui";
import { MCP_CLIENTS, McpClientId, TOKEN_PLACEHOLDER } from "../models/mcp-clients";
import { useMcpDialogStore } from "../stores/use-mcp-dialog-store";

const getServerUrl = () => `${getHttpUrl()}/mcp`;

const formatDate = (date: Date | string | null) =>
    date
        ? new Date(date).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" })
        : "Never";

const CopyButton = ({ text, label }: { text: string; label: string }) => {
    const [isCopied, setIsCopied] = useState(false);

    const copy = async () => {
        if (!(await copyToClipboard(text))) {
            toast.error("Could not copy");
            return;
        }
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 1500);
    };

    return (
        <button
            type="button"
            onClick={copy}
            aria-label={label}
            title={label}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-zinc-500 hover:bg-black/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
        >
            {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
    );
};

const Snippet = ({ token }: { token: string | undefined }) => {
    const [client, setClient] = useState<McpClientId>("claude-code");
    const selected = MCP_CLIENTS.find(item => item.id === client)!;
    const snippet = selected.getSnippet(getServerUrl(), token ?? TOKEN_PLACEHOLDER);

    return (
        <div>
            <div className="mb-2 flex items-center gap-1">
                {MCP_CLIENTS.map(item => (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => setClient(item.id)}
                        className={cn(
                            "h-7 rounded-md px-2.5 text-[12.5px] font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white",
                            client === item.id &&
                                "bg-[#de9239]/15 text-[#9a5512] hover:text-[#9a5512] dark:text-[#f0a650] dark:hover:text-[#f0a650]"
                        )}
                    >
                        {item.label}
                    </button>
                ))}
                <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">
                    {selected.hint}
                </span>
            </div>
            <div className="flex items-start gap-1 rounded-lg bg-black/[0.04] p-2 dark:bg-white/[0.05]">
                <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre font-mono text-[12px] leading-relaxed">
                    {snippet}
                </pre>
                <CopyButton text={snippet} label="Copy" />
            </div>
        </div>
    );
};

const NewToken = ({ token, onDone }: { token: string; onDone: () => void }) => (
    <div className="rounded-lg bg-[#fdf0dc] p-3 text-[12.5px] text-[#7a420c] dark:bg-[#3a2a14] dark:text-[#f0c48a]">
        <p className="mb-2 font-semibold">Copy your token now. It won't be shown again.</p>
        <div className="flex items-center gap-1 rounded-md bg-white/70 px-2 py-1 dark:bg-black/30">
            <code className="min-w-0 flex-1 truncate font-mono text-[12px]">{token}</code>
            <CopyButton text={token} label="Copy token" />
        </div>
        <button type="button" onClick={onDone} className="mt-2 text-xs underline">
            I've copied it
        </button>
    </div>
);

const Tokens = ({ onCreated }: { onCreated: (token: string) => void }) => {
    const utils = trpc.useUtils();
    const { data: tokens } = trpc.mcp.listTokens.useQuery();
    const [name, setName] = useState("");
    const createToken = trpc.mcp.createToken.useMutation({
        onSuccess: created => {
            setName("");
            onCreated(created.token);
            void utils.mcp.listTokens.invalidate();
        },
        onError: error => toast.error(error.message),
    });
    const revokeToken = trpc.mcp.revokeToken.useMutation({
        onSuccess: () => void utils.mcp.listTokens.invalidate(),
        onError: error => toast.error(error.message),
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (name.trim()) createToken.mutate({ name: name.trim() });
    };

    return (
        <div className="space-y-2">
            <form onSubmit={submit} className="flex gap-2">
                <input
                    value={name}
                    onChange={event => setName(event.target.value)}
                    placeholder="Name, like “Laptop” or “Claude Code”"
                    maxLength={60}
                    aria-label="Token name"
                    className="h-9 min-w-0 flex-1 rounded-lg bg-transparent px-3 text-[13px] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)] outline-none focus:shadow-[inset_0_0_0_1.5px_#de9239] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]"
                />
                <button
                    type="submit"
                    disabled={!name.trim() || createToken.isPending}
                    className="h-9 shrink-0 rounded-lg bg-[#ffd8a8] px-3 text-[13px] font-semibold text-[#1e1e1e] hover:bg-[#ffc078] disabled:opacity-50"
                >
                    Create token
                </button>
            </form>
            {tokens && tokens.length > 0 ? (
                <ul className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
                    {tokens.map(token => (
                        <li key={token.id} className="flex items-center gap-3 py-2 text-[13px]">
                            <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium">{token.name}</span>
                                <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                                    Created {formatDate(token.createdAt)} · Last used{" "}
                                    {formatDate(token.lastUsedAt)}
                                </span>
                            </span>
                            <button
                                type="button"
                                disabled={revokeToken.isPending}
                                onClick={() => {
                                    if (
                                        confirm(
                                            `Revoke “${token.name}”? Agents using it stop working.`
                                        )
                                    ) {
                                        revokeToken.mutate({ id: token.id });
                                    }
                                }}
                                className="h-7 rounded-md px-2 text-xs font-medium text-[#c92a2a] hover:bg-[#c92a2a]/10 dark:text-[#ff8787]"
                            >
                                Revoke
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="py-1 text-xs text-zinc-500 dark:text-zinc-400">No tokens yet.</p>
            )}
        </div>
    );
};

const Heading = ({ children }: { children: string }) => (
    <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {children}
    </h3>
);

const ProContent = () => {
    const [token, setToken] = useState<string>();

    return (
        <>
            <section>
                <Heading>Server URL</Heading>
                <div className="flex items-center gap-1 rounded-lg bg-black/[0.04] px-2 py-1 dark:bg-white/[0.05]">
                    <code className="min-w-0 flex-1 truncate font-mono text-[12px]">
                        {getServerUrl()}
                    </code>
                    <CopyButton text={getServerUrl()} label="Copy URL" />
                </div>
            </section>
            <section>
                <Heading>Tokens</Heading>
                {token ? (
                    <div className="mb-3">
                        <NewToken token={token} onDone={() => setToken(undefined)} />
                    </div>
                ) : null}
                <Tokens onCreated={setToken} />
            </section>
            <section>
                <Heading>Add it to your agent</Heading>
                <Snippet token={token} />
            </section>
        </>
    );
};

const McpDialog = ({ onClose }: { onClose: () => void }) => {
    const { isAuthenticated } = useAuth();
    const { data: status } = trpc.ai.status.useQuery(undefined, { enabled: isAuthenticated });
    const isPro = status?.plan === "pro";

    return (
        <Modal.Container
            show
            setShow={onClose}
            backgroundClassName="px-4 bg-opacity-20 dark:bg-opacity-50"
        >
            <div
                role="dialog"
                aria-modal
                aria-label="Connect an AI agent"
                className="flex max-h-[88vh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl bg-white text-[#1b1b1f] shadow-[0_30px_70px_-24px_rgba(25,25,60,0.45),0_0_0_1px_rgba(20,20,40,0.07)] duration-200 animate-in fade-in-0 zoom-in-[0.98] dark:bg-[#1d1d23] dark:text-[#ececf1] dark:[color-scheme:dark]"
            >
                <header className="flex h-[52px] shrink-0 items-center gap-2 px-5">
                    <Plug className={cn("h-[18px] w-[18px]", BRAND_TEXT)} />
                    <h2 className="text-[15px] font-semibold">Connect an AI agent</h2>
                    <PlanBadge plan="pro" />
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-zinc-400 hover:bg-black/5 hover:text-[#1b1b1f] dark:hover:bg-white/10 dark:hover:text-white"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </header>
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-5">
                    <p className="text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                        Let agents like Claude Code, opencode and Codex list, read, create and
                        change your drawings over MCP. Changes show up live for anyone who has the
                        drawing open.
                    </p>
                    {!isAuthenticated ? (
                        <p className="text-[13px]">Sign in to connect an agent.</p>
                    ) : null}
                    {isAuthenticated && status && !isPro ? (
                        <p className="text-[13px]">
                            MCP is part of Pro. Upgrade to connect an agent.
                        </p>
                    ) : null}
                    {isPro ? <ProContent /> : null}
                </div>
            </div>
        </Modal.Container>
    );
};

export const McpDialogContainer = () => {
    const isOpen = useMcpDialogStore(s => s.isOpen);
    const close = useMcpDialogStore(s => s.close);
    return isOpen ? <McpDialog onClose={close} /> : null;
};
