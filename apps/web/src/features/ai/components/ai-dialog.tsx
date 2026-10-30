import { Modal } from "@/components/modal";
import { useAuth } from "@/contexts/auth-context";
import { useGlobal } from "@/contexts/global-context";
import { useInsertElement } from "@/features/add-element/hooks/use-insert-element";
import { useLinkContent } from "@/features/link-card/hooks/use-link-content";
import { MermaidBlock } from "@/features/mermaid/models/mermaid-block";
import { trpc } from "@/lib/trpc";
import { useTheme } from "@/providers/theme-provider";
import { useSignInModalStore } from "@/stores/use-sign-in-modal-store";
import { formatShortcut } from "@/utils/platform";
import { exportToSvg } from "@excalidraw/excalidraw";
import { TRPCClientError } from "@trpc/client";
import { AI_FREE_DAILY_LIMIT, AiStatus, DiagramSpec } from "common";
import { ArrowUp, Code, Loader2, RotateCcw, Sparkles, X } from "lucide-react";
import { KeyboardEvent, ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "ui";
import { AiResult, AiResultUtil } from "../models/ai-result";
import { DiagramBuilder, Point } from "../models/diagram-builder";
import { DiagramReader, Selection } from "../models/diagram-reader";
import { AiMode, useAiDialogStore } from "../stores/use-ai-dialog-store";

const EXAMPLES: Record<AiMode, string[]> = {
    diagram: [
        "Login flow with 2FA and what happens when it fails",
        "Architecture of a web app with an API, a database and a cache",
        "Sprint retro: went well, to improve, actions",
        "Compare Postgres, MongoDB and SQLite in a table",
    ],
    mermaid: [
        "Sequence diagram of signing in with GitHub",
        "ER diagram for a blog with users, posts and comments",
        "Gantt chart for a two-month website redesign",
        "State diagram of an order from cart to delivery",
    ],
};

const MODES: { mode: AiMode; label: string }[] = [
    { mode: "diagram", label: "Diagram" },
    { mode: "mermaid", label: "Mermaid" },
];

type Message = { role: "user" | "ai" | "error"; text: string };

/** A request and what came of it, to go back to for "Try again" */
type Turn = { prompt: string; mode: AiMode; result?: AiResult };

const getLimitMessage = (status: AiStatus | undefined) => {
    if (!status) return "You've used your AI requests for today. They're back tomorrow.";
    const time = new Date(status.resetsAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    });
    return `You've used your ${status.limit} AI requests for today. They're back at ${time}.`;
};

const getErrorMessage = (error: unknown, status: AiStatus | undefined) => {
    if (error instanceof TRPCClientError) {
        const code = error.data?.code as string | undefined;
        if (code === "TOO_MANY_REQUESTS") return getLimitMessage(status);
        if (code === "PRECONDITION_FAILED") return "AI is turned off on this server.";
        if (code === "CONFLICT") return "Wait for the last request to finish.";
        if (error.message) return error.message;
    }
    return "Something went wrong. Try again.";
};

const Segment = ({
    isActive,
    onClick,
    children,
}: {
    isActive: boolean;
    onClick: () => void;
    children: ReactNode;
}) => (
    <button
        type="button"
        onClick={onClick}
        className={cn(
            "h-7 rounded-md px-2.5 text-[12.5px] font-medium transition-colors",
            isActive
                ? "bg-[#ecebff] font-semibold text-[#4a47b1] dark:bg-[#a8a5ff]/15 dark:text-[#b7b5ff]"
                : "text-zinc-500 hover:text-[#1b1b1f] dark:text-zinc-400 dark:hover:text-white"
        )}
    >
        {children}
    </button>
);

/** Dots for the requests left today, or "Unlimited" */
const Quota = ({ status }: { status: AiStatus | undefined }) => {
    if (!status) return null;
    if (status.limit === null) {
        return (
            <span className="flex items-center gap-2">
                <span className="rounded bg-gradient-to-br from-[#6965db] to-[#b4529c] px-1.5 py-px text-[10px] font-bold uppercase tracking-wider text-white">
                    Pro
                </span>
                Unlimited
            </span>
        );
    }
    const left = Math.max(status.limit - status.used, 0);
    return (
        <span className="flex items-center gap-2">
            <span className="flex gap-[3px]">
                {Array.from({ length: status.limit }, (_, i) => (
                    <span
                        key={i}
                        className={cn(
                            "h-[7px] w-[7px] rounded-full",
                            i < status.used
                                ? "bg-black/10 dark:bg-white/15"
                                : "bg-[#6965db] dark:bg-[#a8a5ff]"
                        )}
                    />
                ))}
            </span>
            {left} of {status.limit} left today
        </span>
    );
};

const getPlaceholder = (mode: AiMode, isChanging: boolean) => {
    if (isChanging) return "Ask for a change…";
    return mode === "diagram" ? "Describe a diagram…" : "Describe a Mermaid diagram…";
};

const renderPreview = async (result: AiResult, isDark: boolean) => {
    const svg = await exportToSvg({
        // @ts-ignore - better local typings
        elements: result.built.elements,
        files: Object.fromEntries(result.built.files.map(file => [file.id, file])),
        appState: { exportBackground: false, exportWithDarkMode: isDark },
        exportPadding: 16,
        skipInliningFonts: true,
    });
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    return svg;
};

/** Ask for a diagram or a Mermaid diagram, see it, ask for changes, and insert it */
const AiDialog = ({ onClose }: { onClose: () => void }) => {
    const { excalidrawApi } = useGlobal();
    const { isAuthenticated } = useAuth();
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === "dark";
    const mode = useAiDialogStore(state => state.mode);
    const setMode = useAiDialogStore(state => state.setMode);
    const initialPrompt = useAiDialogStore(state => state.prompt);
    const setShowSignIn = useSignInModalStore(state => state.setShowSignInModal);
    const { getStartPlacement } = useInsertElement();
    const getLinkContent = useLinkContent();
    const utils = trpc.useUtils();
    const { data: status } = trpc.ai.status.useQuery(undefined, { enabled: isAuthenticated });

    // What was selected when the dialog opened, which the result takes the place of
    const [selection, setSelection] = useState<Selection | undefined>(() => {
        if (!excalidrawApi) return undefined;
        const { selectedElementIds } = excalidrawApi.getAppState();
        const scene = excalidrawApi.getSceneElements();
        const selected = scene.filter(element => selectedElementIds[element.id]);
        if (selected.length === 0) return undefined;
        const read = DiagramReader.read(selected, scene);
        return read.spec || read.mermaid ? read : undefined;
    });
    const [turns, setTurns] = useState<Turn[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [prompt, setPrompt] = useState("");
    const [isBusy, setIsBusy] = useState(false);
    const [showCode, setShowCode] = useState(false);
    const preview = useRef<HTMLDivElement>(null);
    const list = useRef<HTMLDivElement>(null);
    const hasSent = useRef(false);

    const result = [...turns].reverse().find(turn => turn.result)?.result;

    useEffect(() => {
        let isCancelled = false;
        if (!result) {
            preview.current?.replaceChildren();
            return;
        }
        renderPreview(result, isDark)
            .then(svg => !isCancelled && preview.current?.replaceChildren(svg))
            .catch(() => undefined);
        return () => {
            isCancelled = true;
        };
    }, [result, isDark]);

    useEffect(() => {
        list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
    }, [messages, isBusy]);

    const buildDiagram = async (spec: DiagramSpec, positions: Map<string, Point> | undefined) =>
        DiagramBuilder.build(spec, {
            positions,
            getLinkContent: url => getLinkContent(url, "compact"),
        });

    /** A Mermaid diagram drawn, fixed once by the AI if Mermaid can't read it */
    const buildMermaid = async (definition: string, request: string) => {
        try {
            return { definition, built: await MermaidBlock.create(definition, "block") };
        } catch (error) {
            const fixed = await utils.client.ai.mermaid.mutate({
                prompt: request,
                fix: { definition, error: error instanceof Error ? error.message : String(error) },
            });
            return {
                definition: fixed.definition,
                built: await MermaidBlock.create(fixed.definition, "block"),
            };
        }
    };

    /** What a request changes: the last result, else what was selected */
    const getCurrent = (previous: AiResult | undefined) => {
        if (previous?.mode === "diagram") {
            return { spec: previous.spec, positions: previous.built.positions };
        }
        if (previous?.mode === "mermaid") return { mermaid: previous.definition };
        return {
            spec: selection?.spec,
            positions: selection?.positions,
            mermaid: selection?.mermaid?.definition,
        };
    };

    const askDiagram = async (request: string, previous: AiResult | undefined) => {
        const { spec, positions, mermaid } = getCurrent(previous);
        const answer = await utils.client.ai.diagram.mutate({
            prompt: request,
            current: spec,
            mermaid,
        });
        // Things that were there stay put, unless it's turned around
        const isSameWay = spec?.direction === answer.diagram.direction;
        const built = await buildDiagram(answer.diagram, isSameWay ? positions : undefined);
        return {
            mode: "diagram",
            summary: answer.summary,
            spec: answer.diagram,
            built,
        } satisfies AiResult;
    };

    const askMermaid = async (request: string, previous: AiResult | undefined) => {
        const { spec, mermaid } = getCurrent(previous);
        const answer = await utils.client.ai.mermaid.mutate({
            prompt: request,
            current: mermaid,
            diagram: spec,
        });
        const drawn = await buildMermaid(answer.definition, request);
        return { mode: "mermaid", summary: answer.summary, ...drawn } satisfies AiResult;
    };

    const ask = (request: string, requestMode: AiMode, previous: AiResult | undefined) =>
        requestMode === "diagram" ? askDiagram(request, previous) : askMermaid(request, previous);

    const send = async (text: string, previousTurns = turns) => {
        const request = text.trim();
        if (!request || isBusy) return;
        setPrompt("");
        setIsBusy(true);
        setMessages(current => [...current, { role: "user", text: request }]);
        const previous = [...previousTurns].reverse().find(turn => turn.result)?.result;

        try {
            const answer = await ask(request, mode, previous);
            setTurns([...previousTurns, { prompt: request, mode, result: answer }]);
            setMessages(current => [...current, { role: "ai", text: answer.summary }]);
        } catch (error) {
            setTurns([...previousTurns, { prompt: request, mode }]);
            setMessages(current => [
                ...current,
                { role: "error", text: getErrorMessage(error, status) },
            ]);
        } finally {
            setIsBusy(false);
            void utils.ai.status.invalidate();
        }
    };

    // What was typed in ⌘K is sent right away
    useEffect(() => {
        if (hasSent.current || !initialPrompt || !isAuthenticated) return;
        hasSent.current = true;
        void send(initialPrompt);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const tryAgain = () => {
        const last = turns.at(-1);
        if (!last) return;
        setMessages(current => current.slice(0, -2));
        void send(last.prompt, turns.slice(0, -1));
    };

    const insert = () => {
        const placement = getStartPlacement();
        if (!excalidrawApi || !result || !placement) return;
        AiResultUtil.insert(excalidrawApi, result, selection, placement);
        onClose();
    };

    const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && result) {
            event.preventDefault();
            insert();
            return;
        }
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void send(prompt);
        }
    };

    const left =
        status && status.limit !== null ? Math.max(status.limit - status.used, 0) : undefined;
    const isOutOfRequests = left === 0;

    return (
        <Modal.Container
            show
            setShow={onClose}
            backgroundClassName="px-4 bg-opacity-20 dark:bg-opacity-50"
        >
            <div
                role="dialog"
                aria-modal
                aria-label="Create with AI"
                className="flex h-[min(620px,88vh)] w-full max-w-[1080px] flex-col overflow-hidden rounded-2xl bg-white text-[#1b1b1f] shadow-[0_30px_70px_-24px_rgba(25,25,60,0.45),0_0_0_1px_rgba(20,20,40,0.07)] duration-200 animate-in fade-in-0 zoom-in-[0.98] dark:bg-[#1d1d23] dark:text-[#ececf1] dark:shadow-[0_30px_70px_-24px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.07)] dark:[color-scheme:dark] sm:flex-row"
            >
                <section className="flex min-h-0 flex-col border-black/[0.07] dark:border-white/[0.07] sm:w-[360px] sm:shrink-0 sm:border-r">
                    <header className="flex h-[52px] shrink-0 items-center gap-2 px-4">
                        <Sparkles className="h-[18px] w-[18px] text-[#b4529c] dark:text-[#f09ad8]" />
                        <h2 className="text-[15px] font-semibold">Create with AI</h2>
                        <span className="ml-auto inline-flex rounded-lg p-0.5 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]">
                            {MODES.map(option => (
                                <Segment
                                    key={option.mode}
                                    isActive={mode === option.mode}
                                    onClick={() => setMode(option.mode)}
                                >
                                    {option.label}
                                </Segment>
                            ))}
                        </span>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close"
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-400 hover:bg-black/5 hover:text-[#1b1b1f] dark:hover:bg-white/10 dark:hover:text-white sm:hidden"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </header>

                    {selection ? (
                        <div className="mx-4 mb-1 flex items-center gap-2 rounded-lg bg-[#fdf0dc] px-2.5 py-1.5 text-[12.5px] text-[#9a5512] dark:bg-[#3a2a14] dark:text-[#f0a650]">
                            <span className="min-w-0 flex-1">
                                <b className="font-semibold">Changing</b> {selection.summary}
                                {selection.skipped > 0
                                    ? `. ${selection.skipped} other ${selection.skipped === 1 ? "thing stays" : "things stay"} as ${selection.skipped === 1 ? "it is" : "they are"}.`
                                    : ""}
                            </span>
                            <button
                                type="button"
                                aria-label="Make a new one instead"
                                title="Make a new one instead"
                                disabled={turns.length > 0}
                                onClick={() => setSelection(undefined)}
                                className="grid h-5 w-5 shrink-0 place-items-center rounded hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/10"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    ) : null}

                    <div ref={list} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-2">
                        {messages.length === 0 && isAuthenticated ? (
                            <div className="space-y-2 pt-1">
                                <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                                    {mode === "diagram"
                                        ? "Describe a diagram: shapes, arrows, groups, notes, tables, charts and code. You can change it before inserting."
                                        : "Describe a Mermaid diagram: flowchart, sequence, class, ER, state, Gantt and more."}
                                </p>
                                {selection || isOutOfRequests
                                    ? null
                                    : EXAMPLES[mode].map(example => (
                                          <button
                                              key={example}
                                              type="button"
                                              onClick={() => setPrompt(example)}
                                              className="block w-full rounded-lg px-2.5 py-1.5 text-left text-[12.5px] text-zinc-600 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] hover:bg-black/[0.03] dark:text-zinc-300 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] dark:hover:bg-white/[0.04]"
                                          >
                                              {example}
                                          </button>
                                      ))}
                            </div>
                        ) : null}
                        {!isAuthenticated ? (
                            <div className="space-y-3 pt-1 text-[13px] leading-relaxed">
                                <p>
                                    Sign in to create diagrams with AI. It's free, with{" "}
                                    {AI_FREE_DAILY_LIMIT} a day.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onClose();
                                        setShowSignIn(true);
                                    }}
                                    className="flex h-8 items-center rounded-lg bg-[#6965db] px-3.5 text-[13px] font-semibold text-white dark:bg-[#a8a5ff] dark:text-[#121212]"
                                >
                                    Sign in
                                </button>
                            </div>
                        ) : null}
                        {messages.map((message, i) => (
                            <div
                                key={i}
                                className={cn(
                                    "rounded-xl px-3 py-2 text-[13px] leading-relaxed",
                                    message.role === "user" &&
                                        "ml-8 bg-[#ecebff] text-[#4a47b1] dark:bg-[#a8a5ff]/15 dark:text-[#cfcdff]",
                                    message.role === "ai" &&
                                        "mr-4 bg-black/[0.04] dark:bg-white/[0.05]",
                                    message.role === "error" &&
                                        "mr-4 bg-[#fff5f5] text-[#c92a2a] dark:bg-[#2c1a1a] dark:text-[#ffa8a8]"
                                )}
                            >
                                {message.text}
                            </div>
                        ))}
                        {isOutOfRequests && status ? (
                            <div className="mr-4 rounded-xl bg-[#fdf0dc] px-3 py-2 text-[13px] leading-relaxed text-[#9a5512] dark:bg-[#3a2a14] dark:text-[#f0a650]">
                                {getLimitMessage(status)}
                            </div>
                        ) : null}
                        {isBusy ? (
                            <div className="mr-4 flex items-center gap-2 rounded-xl bg-black/[0.04] px-3 py-2 text-[13px] text-zinc-500 dark:bg-white/[0.05] dark:text-zinc-400">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                {mode === "diagram" ? "Drawing…" : "Writing…"}
                            </div>
                        ) : null}
                    </div>

                    {isAuthenticated ? (
                        <div className="shrink-0 px-4 pb-1">
                            <div className="flex items-end gap-2 rounded-xl px-3 py-2 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)] focus-within:shadow-[inset_0_0_0_2px_#6965db] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] dark:focus-within:shadow-[inset_0_0_0_2px_#a8a5ff]">
                                <textarea
                                    autoFocus
                                    value={prompt}
                                    onChange={event => setPrompt(event.target.value)}
                                    onKeyDown={onKeyDown}
                                    rows={3}
                                    maxLength={2000}
                                    disabled={isOutOfRequests}
                                    aria-label="What to make"
                                    placeholder={getPlaceholder(mode, Boolean(result || selection))}
                                    className="min-w-0 flex-1 resize-none bg-transparent text-[13.5px] leading-relaxed outline-none placeholder:text-zinc-400"
                                />
                                <button
                                    type="button"
                                    onClick={() => void send(prompt)}
                                    disabled={isBusy || !prompt.trim() || isOutOfRequests}
                                    aria-label="Send"
                                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#6965db] text-white transition-opacity disabled:opacity-40 dark:bg-[#a8a5ff] dark:text-[#121212]"
                                >
                                    <ArrowUp className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ) : null}
                    <footer className="flex h-10 shrink-0 items-center px-4 text-[12px] text-zinc-500 dark:text-zinc-400">
                        <Quota status={status} />
                    </footer>
                </section>

                <section className="relative min-h-[240px] flex-1 bg-white bg-[radial-gradient(rgba(0,0,0,0.06)_1.2px,transparent_1.2px)] [background-size:24px_24px] dark:bg-[#121212] dark:bg-[radial-gradient(rgba(255,255,255,0.05)_1.2px,transparent_1.2px)]">
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="absolute right-3 top-3 z-10 hidden h-8 w-8 place-items-center rounded-lg text-zinc-400 hover:bg-black/5 hover:text-[#1b1b1f] dark:hover:bg-white/10 dark:hover:text-white sm:grid"
                    >
                        <X className="h-4 w-4" />
                    </button>
                    <div
                        ref={preview}
                        aria-label="Preview"
                        className={cn(
                            "absolute inset-x-6 bottom-16 top-12 flex items-center justify-center transition-opacity",
                            isBusy && "opacity-30",
                            showCode && result?.mode === "mermaid" && "bottom-[45%]"
                        )}
                    />
                    {!result && !isBusy ? (
                        <div className="absolute inset-0 grid place-items-center text-[13px] text-zinc-400">
                            {selection
                                ? "The changed diagram shows up here"
                                : "Your diagram shows up here"}
                        </div>
                    ) : null}
                    {isBusy && !result ? (
                        <div className="absolute inset-12 animate-pulse rounded-xl border-2 border-dashed border-[#6965db]/40" />
                    ) : null}
                    {showCode && result?.mode === "mermaid" ? (
                        <pre className="absolute inset-x-4 bottom-16 top-[57%] overflow-auto rounded-lg bg-[#f6f8fa] p-3 font-mono text-[12px] leading-relaxed dark:bg-[#18181d]">
                            {result.definition}
                        </pre>
                    ) : null}
                    {result ? (
                        <div className="absolute inset-x-4 bottom-4 flex items-center gap-2">
                            {result.mode === "mermaid" ? (
                                <button
                                    type="button"
                                    onClick={() => setShowCode(value => !value)}
                                    className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-zinc-600 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)] hover:bg-black/[0.03] dark:text-zinc-300 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]"
                                >
                                    <Code className="h-3.5 w-3.5" />
                                    {showCode ? "Hide code" : "Code"}
                                </button>
                            ) : null}
                            <span className="flex-1" />
                            <button
                                type="button"
                                onClick={tryAgain}
                                disabled={isBusy || isOutOfRequests}
                                className="flex h-8 items-center gap-1.5 rounded-lg bg-white px-3 text-[13px] font-medium shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)] hover:bg-black/[0.03] disabled:opacity-40 dark:bg-[#1d1d23] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]"
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Try again
                            </button>
                            <button
                                type="button"
                                onClick={insert}
                                disabled={isBusy}
                                className="flex h-8 items-center gap-2 rounded-lg bg-[#6965db] px-3.5 text-[13px] font-semibold text-white transition-opacity disabled:opacity-40 dark:bg-[#a8a5ff] dark:text-[#121212]"
                            >
                                {selection ? "Replace" : "Insert"}
                                <span className="text-[11px] opacity-70">
                                    {formatShortcut("↵")}
                                </span>
                            </button>
                        </div>
                    ) : null}
                </section>
            </div>
        </Modal.Container>
    );
};

export const AiDialogContainer = () => {
    const isOpen = useAiDialogStore(state => state.isOpen);
    const close = useAiDialogStore(state => state.close);
    return isOpen ? <AiDialog onClose={close} /> : null;
};
