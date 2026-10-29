import { Hint } from "@/components/keys";
import { Modal } from "@/components/modal";
import { useGlobal } from "@/contexts/global-context";
import { useDebounce } from "@uidotdev/usehooks";
import { Loader2, X } from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { cn } from "ui";
import { useLinkContent } from "../hooks/use-link-content";
import { LINK_LOOKS, LinkCard } from "../models/link-card";
import type { LinkContent, LinkLook } from "../models/link-card-render";
import { LinkCardTarget, useLinkCardStore } from "../stores/use-link-card-store";

const LABELS: Record<LinkCardTarget["kind"], { title: string; action: string }> = {
    insert: { title: "Link card", action: "Insert" },
    edit: { title: "Edit link", action: "Save" },
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

/** What to do, or what's happening, under the card */
const getHint = (input: string, url: string | undefined, isLoading: boolean) => {
    if (!input.trim()) return "Paste a link to a page";
    if (!url) return "That isn't a web address";
    if (isLoading) return "Getting the page's title and icon…";
    return undefined;
};

type Props = { target: LinkCardTarget; onClose: () => void };

/** Type or paste a link, see its card, and add it or change a card's link */
export const LinkCardDialog = ({ target, onClose }: Props) => {
    const { excalidrawApi } = useGlobal();
    const getLinkContent = useLinkContent();
    const savedLook = useLinkCardStore(state => state.look);

    const initial = useMemo(() => {
        const card =
            target.kind === "edit"
                ? excalidrawApi?.getSceneElements().find(e => e.id === target.id)
                : undefined;
        return card ? LinkCard.getContent(card) : undefined;
    }, [excalidrawApi, target]);

    const [input, setInput] = useState(initial?.url ?? "");
    const [look, setLook] = useState<LinkLook>(initial?.look ?? savedLook);
    const [content, setContent] = useState<LinkContent | undefined>(initial);
    const [image, setImage] = useState<string>();
    const [isBusy, setIsBusy] = useState(false);
    const url = LinkCard.normalizeUrl(input);
    const debouncedUrl = useDebounce(url, 400);

    // What the page says about itself, once typing stops
    useEffect(() => {
        if (!debouncedUrl || debouncedUrl === content?.url) return;
        let isCancelled = false;
        void getLinkContent(debouncedUrl, look).then(next => !isCancelled && setContent(next));
        return () => {
            isCancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedUrl]);

    // The card, drawn like on the canvas
    useEffect(() => {
        if (!content) return;
        let isCancelled = false;
        void LinkCard.render({ ...content, look }).then(
            ({ file }) => !isCancelled && setImage(file.dataURL)
        );
        return () => {
            isCancelled = true;
        };
    }, [content, look]);

    const isLoading = Boolean(url) && content?.url !== url;

    const submit = async (event?: FormEvent) => {
        event?.preventDefault();
        if (!excalidrawApi || !url || isBusy) return;
        setIsBusy(true);
        try {
            const next =
                content?.url === url ? { ...content, look } : await getLinkContent(url, look);
            if (target.kind === "insert") {
                useLinkCardStore.getState().setLook(look);
                await LinkCard.insert(excalidrawApi, next, target.placement);
            } else {
                await LinkCard.apply(excalidrawApi, { id: target.id, changes: next });
            }
            onClose();
        } catch {
            setIsBusy(false);
            toast.error("Couldn't make the card");
        }
    };

    const labels = LABELS[target.kind];
    const hint = getHint(input, url, isLoading);

    return (
        <Modal.Container
            show
            setShow={onClose}
            backgroundClassName="px-4 bg-opacity-20 dark:bg-opacity-50"
        >
            <form
                role="dialog"
                aria-modal
                aria-label={labels.title}
                onSubmit={event => void submit(event)}
                className="flex w-full max-w-[520px] flex-col overflow-hidden rounded-2xl bg-white text-[#1b1b1f] shadow-[0_30px_70px_-24px_rgba(25,25,60,0.45),0_0_0_1px_rgba(20,20,40,0.07)] duration-200 animate-in fade-in-0 zoom-in-[0.98] dark:bg-[#1d1d23] dark:text-[#ececf1] dark:shadow-[0_30px_70px_-24px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.07)] dark:[color-scheme:dark]"
            >
                <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-black/[0.07] px-4 dark:border-white/[0.07]">
                    <h2 className="text-[15px] font-semibold">{labels.title}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-400 hover:bg-black/5 hover:text-[#1b1b1f] dark:hover:bg-white/10 dark:hover:text-white"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </header>

                <div className="flex flex-col gap-3 p-4">
                    <input
                        autoFocus
                        value={input}
                        onChange={event => setInput(event.target.value)}
                        onFocus={event => event.currentTarget.select()}
                        placeholder="https://"
                        aria-label="Link"
                        spellCheck={false}
                        autoComplete="off"
                        className="h-10 rounded-lg bg-[#f6f8fa] px-3 text-[14px] outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-[#6965db] dark:bg-[#18181d] dark:ring-white/10 dark:focus:ring-[#a8a5ff]"
                    />
                    <div className="relative grid h-[180px] place-items-center rounded-xl bg-white bg-[radial-gradient(rgba(0,0,0,0.06)_1.2px,transparent_1.2px)] ring-1 ring-black/[0.07] [background-size:24px_24px] dark:bg-[#121212] dark:bg-[radial-gradient(rgba(255,255,255,0.05)_1.2px,transparent_1.2px)] dark:ring-white/[0.07]">
                        {image && url ? (
                            <img
                                src={image}
                                alt=""
                                className={cn(
                                    "max-h-[160px] max-w-[90%] object-contain transition-opacity dark:[filter:invert(93%)_hue-rotate(180deg)]",
                                    isLoading && "opacity-30"
                                )}
                            />
                        ) : null}
                        {hint ? (
                            <span className="absolute inset-x-4 bottom-3 flex items-center justify-center gap-2 text-center text-[12.5px] text-zinc-500 dark:text-zinc-400">
                                {isLoading ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : null}
                                {hint}
                            </span>
                        ) : null}
                    </div>
                </div>

                <footer className="flex shrink-0 flex-wrap items-center gap-3 border-t border-black/[0.07] bg-black/[0.02] px-4 py-2.5 text-[12.5px] text-zinc-500 dark:border-white/[0.07] dark:bg-white/[0.02] dark:text-zinc-400">
                    <span>Look</span>
                    <span className="inline-flex rounded-lg p-0.5 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]">
                        {LINK_LOOKS.map(option => (
                            <Segment
                                key={option.look}
                                isActive={look === option.look}
                                onClick={() => setLook(option.look)}
                            >
                                {option.label}
                            </Segment>
                        ))}
                    </span>
                    <span className="ml-auto hidden sm:inline">
                        <Hint keys={["esc"]}>Close</Hint>
                    </span>
                    <button
                        type="submit"
                        disabled={isBusy || !url}
                        className="flex h-8 items-center gap-2 rounded-lg bg-[#6965db] px-3.5 text-[13px] font-semibold text-white transition-opacity disabled:opacity-40 dark:bg-[#a8a5ff] dark:text-[#121212]"
                    >
                        {labels.action}
                        <span className="text-[11px] opacity-70">↵</span>
                    </button>
                </footer>
            </form>
        </Modal.Container>
    );
};
