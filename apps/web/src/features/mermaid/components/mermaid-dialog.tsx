import { Hint } from "@/components/keys";
import { Modal } from "@/components/modal";
import { useGlobal } from "@/contexts/global-context";
import { CustomDataUtil } from "@/features/draw/utils/custom-data-util";
import { useTheme } from "@/providers/theme-provider";
import { formatShortcut } from "@/utils/platform";
import { exportToSvg } from "@excalidraw/excalidraw";
import { useDebounce } from "@uidotdev/usehooks";
import { X } from "lucide-react";
import { KeyboardEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { cn } from "ui";
import { MermaidBlock } from "../models/mermaid-block";
import { MERMAID_EXAMPLES } from "../models/mermaid-examples";
import { MermaidRenderer } from "../models/mermaid-renderer";
import {
    MermaidMode,
    MermaidTarget,
    useMermaidDialogStore,
} from "../stores/use-mermaid-dialog-store";

const MODES: { mode: MermaidMode; label: string; description: string }[] = [
    {
        mode: "shapes",
        label: "Shapes",
        description: "Each box and arrow becomes a shape to move and restyle",
    },
    {
        mode: "block",
        label: "Mermaid block",
        description: "Stays Mermaid: double-click it to change the diagram",
    },
];

type Preview = { node: Element } | { error: string };

/** What the chosen mode does with this diagram */
const getModeHint = (definition: string, mode: MermaidMode) =>
    mode === "shapes" && definition.trim() && !MermaidRenderer.canBeShapes(definition)
        ? "This kind of diagram can't become shapes, so it's added as a Mermaid block"
        : MODES.find(option => option.mode === mode)?.description;

const LABELS: Record<MermaidTarget["kind"], { title: string; action: string; mode: string }> = {
    insert: { title: "Mermaid", action: "Insert", mode: "Insert as" },
    edit: { title: "Edit Mermaid block", action: "Save", mode: "Keep as" },
};

/** What the diagram will look like, as shapes or as a block */
const renderPreview = async (definition: string, mode: MermaidMode, isDark: boolean) => {
    if (mode === "block" || !MermaidRenderer.canBeShapes(definition)) {
        const { dataURL } = await MermaidRenderer.renderImage(definition);
        const image = document.createElement("img");
        image.src = dataURL;
        image.alt = "";
        image.className = "max-h-full max-w-full object-contain";
        // Like on the canvas, where dark mode inverts it
        if (isDark) image.style.filter = "invert(93%) hue-rotate(180deg)";
        return image;
    }

    const { elements, files } = await MermaidRenderer.renderShapes(definition);
    const svg = await exportToSvg({
        // @ts-ignore - better local typings
        elements,
        files,
        appState: { exportBackground: false, exportWithDarkMode: isDark },
        exportPadding: 8,
        // The page has Excalidraw's fonts already
        skipInliningFonts: true,
    });
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    return svg;
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

type Props = { target: MermaidTarget; onClose: () => void };

/** Write or paste Mermaid, see it drawn, and add it as shapes or a block */
export const MermaidDialog = ({ target, onClose }: Props) => {
    const { excalidrawApi } = useGlobal();
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === "dark";
    const savedMode = useMermaidDialogStore(state => state.mode);
    const setSavedMode = useMermaidDialogStore(state => state.setMode);

    const initialDefinition = useMemo(() => {
        if (target.kind === "insert" || !excalidrawApi) return MERMAID_EXAMPLES[0]!.definition;
        const block = excalidrawApi
            .getSceneElements()
            .find(element => element.id === target.id && CustomDataUtil.isMermaidElement(element));
        return block ? MermaidBlock.getDefinition(block) : "";
    }, [excalidrawApi, target]);

    const [definition, setDefinition] = useState(initialDefinition);
    // A block being changed stays a block, unless it's turned into shapes
    const [mode, setMode] = useState<MermaidMode>(target.kind === "edit" ? "block" : savedMode);
    const [preview, setPreview] = useState<Preview>();
    const [isBusy, setIsBusy] = useState(false);
    const debouncedDefinition = useDebounce(definition, 250);
    const container = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let isCancelled = false;
        if (!debouncedDefinition.trim()) {
            setPreview({ error: "Write a diagram, or start from one above" });
            return;
        }

        renderPreview(debouncedDefinition, mode, isDark)
            .then(node => !isCancelled && setPreview({ node }))
            .catch(
                (error: unknown) =>
                    !isCancelled &&
                    setPreview({ error: error instanceof Error ? error.message : String(error) })
            );
        return () => {
            isCancelled = true;
        };
    }, [debouncedDefinition, mode, isDark]);

    useEffect(() => {
        if (preview && "node" in preview) container.current?.replaceChildren(preview.node);
    }, [preview]);

    const changeMode = (next: MermaidMode) => {
        setMode(next);
        if (target.kind === "insert") setSavedMode(next);
    };

    const submit = async () => {
        if (!excalidrawApi || isBusy || !definition.trim()) return;
        setIsBusy(true);
        try {
            if (target.kind === "insert") {
                await MermaidBlock.insert(excalidrawApi, {
                    definition,
                    mode,
                    placement: target.placement,
                });
            } else if (definition !== initialDefinition || mode === "shapes") {
                await MermaidBlock.update(excalidrawApi, { id: target.id, definition, mode });
            }
            onClose();
        } catch (error) {
            setIsBusy(false);
            toast.error(error instanceof Error ? error.message : "Couldn't draw the diagram");
        }
    };

    const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void submit();
            return;
        }

        // Indents, instead of leaving the field
        if (event.key === "Tab" && !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.setRangeText(
                "    ",
                event.currentTarget.selectionStart,
                event.currentTarget.selectionEnd,
                "end"
            );
            setDefinition(event.currentTarget.value);
        }
    };

    const error = preview && "error" in preview ? preview.error : undefined;
    const isStale = debouncedDefinition !== definition;
    const labels = LABELS[target.kind];

    return (
        <Modal.Container
            show
            setShow={onClose}
            backgroundClassName="px-4 bg-opacity-20 dark:bg-opacity-50"
        >
            <div
                role="dialog"
                aria-modal
                aria-label="Mermaid diagram"
                className="flex h-[min(600px,86vh)] w-full max-w-[1040px] flex-col overflow-hidden rounded-2xl bg-white text-[#1b1b1f] shadow-[0_30px_70px_-24px_rgba(25,25,60,0.45),0_0_0_1px_rgba(20,20,40,0.07)] duration-200 animate-in fade-in-0 zoom-in-[0.98] dark:bg-[#1d1d23] dark:text-[#ececf1] dark:shadow-[0_30px_70px_-24px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.07)] dark:[color-scheme:dark]"
            >
                <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-black/[0.07] px-4 dark:border-white/[0.07]">
                    <h2 className="text-[15px] font-semibold">{labels.title}</h2>
                    <div className="ml-3 flex min-w-0 items-center gap-1.5 overflow-x-auto">
                        <span className="mr-1 shrink-0 text-[12.5px] text-zinc-400">
                            Start from
                        </span>
                        {MERMAID_EXAMPLES.map(example => (
                            <button
                                key={example.id}
                                type="button"
                                onClick={() => setDefinition(example.definition)}
                                className={cn(
                                    "flex h-7 shrink-0 items-center rounded-lg px-2.5 text-[12.5px] font-medium transition-colors",
                                    definition === example.definition
                                        ? "bg-[#1b1b1f] text-white dark:bg-white dark:text-[#1b1b1f]"
                                        : "text-zinc-500 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] hover:text-[#1b1b1f] dark:text-zinc-400 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] dark:hover:text-white"
                                )}
                            >
                                {example.label}
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-400 hover:bg-black/5 hover:text-[#1b1b1f] dark:hover:bg-white/10 dark:hover:text-white"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </header>

                <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
                    <textarea
                        autoFocus
                        value={definition}
                        onChange={event => setDefinition(event.target.value)}
                        onKeyDown={onKeyDown}
                        spellCheck={false}
                        aria-label="Mermaid"
                        className="min-h-[160px] resize-none border-black/[0.07] bg-[#f6f8fa] p-4 font-mono text-[13px] leading-relaxed text-[#1f2328] outline-none sm:w-[40%] sm:border-r dark:border-white/[0.07] dark:bg-[#18181d] dark:text-[#e3e3e8]"
                    />
                    <div className="relative min-h-0 flex-1 bg-white bg-[radial-gradient(rgba(0,0,0,0.06)_1.2px,transparent_1.2px)] [background-size:24px_24px] dark:bg-[#121212] dark:bg-[radial-gradient(rgba(255,255,255,0.05)_1.2px,transparent_1.2px)]">
                        <div
                            ref={container}
                            className={cn(
                                "absolute inset-4 flex items-center justify-center transition-opacity",
                                (error || isStale) && "opacity-30"
                            )}
                        />
                        {error ? (
                            <div className="absolute inset-x-4 bottom-4 max-h-[50%] overflow-auto whitespace-pre-wrap rounded-lg bg-[#fff5f5] px-3 py-2 font-mono text-[12px] text-[#c92a2a] ring-1 ring-[#ffc9c9] dark:bg-[#2c1a1a] dark:text-[#ffa8a8] dark:ring-[#5c2b2b]">
                                {error}
                            </div>
                        ) : null}
                    </div>
                </div>

                <footer className="flex shrink-0 flex-wrap items-center gap-3 border-t border-black/[0.07] bg-black/[0.02] px-4 py-2.5 text-[12.5px] text-zinc-500 dark:border-white/[0.07] dark:bg-white/[0.02] dark:text-zinc-400">
                    <span>{labels.mode}</span>
                    <span className="inline-flex rounded-lg p-0.5 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]">
                        {MODES.map(option => (
                            <Segment
                                key={option.mode}
                                isActive={mode === option.mode}
                                onClick={() => changeMode(option.mode)}
                            >
                                {option.label}
                            </Segment>
                        ))}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{getModeHint(definition, mode)}</span>
                    <span className="hidden sm:inline">
                        <Hint keys={["esc"]}>Close</Hint>
                    </span>
                    <button
                        type="button"
                        onClick={() => void submit()}
                        disabled={isBusy || Boolean(error) || !definition.trim()}
                        className="flex h-8 items-center gap-2 rounded-lg bg-[#6965db] px-3.5 text-[13px] font-semibold text-white transition-opacity disabled:opacity-40 dark:bg-[#a8a5ff] dark:text-[#121212]"
                    >
                        {labels.action}
                        <span className="text-[11px] opacity-70">{formatShortcut("↵")}</span>
                    </button>
                </footer>
            </div>
        </Modal.Container>
    );
};
