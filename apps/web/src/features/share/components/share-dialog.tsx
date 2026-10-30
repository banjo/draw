import "@fontsource-variable/bricolage-grotesque";
import { Modal } from "@/components/modal";
import { useCollection, useCollectionActions } from "@/features/collection/hooks/use-collection";
import { NativeContainer } from "@/features/draw/models/native/native-container";
import { useError } from "@/hooks/use-error";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/auth-context";
import { copyToClipboard } from "@/utils/clipboard";
import { useSignInModalStore } from "@/stores/use-sign-in-modal-store";
import { LinkAccess } from "common";
import {
    BookmarkCheck,
    BookmarkPlus,
    Check,
    Copy,
    CopyPlus,
    Eye,
    Link,
    Lock,
    LucideIcon,
    Pencil,
    X,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { cn } from "ui";
import { useCopyToCollection } from "../hooks/use-copy-to-collection";
import { useShareDialogStore } from "../stores/use-share-dialog-store";

const OPTIONS: { value: LinkAccess; title: string; text: string; Icon: LucideIcon }[] = [
    {
        value: "edit",
        title: "Anyone with the link can edit",
        text: "They draw along with you.",
        Icon: Pencil,
    },
    {
        value: "view",
        title: "Anyone with the link can view",
        text: "They see changes as you make them, but can't change anything.",
        Icon: Eye,
    },
    {
        value: "private",
        title: "Only you",
        text: "Nobody else can open it.",
        Icon: Lock,
    },
];

const SECONDARY_BUTTON =
    "flex h-10 flex-1 items-center justify-center gap-2 rounded-xl text-[13.5px] font-semibold shadow-[inset_0_0_0_1px_rgba(20,20,40,0.14)] transition hover:bg-zinc-50 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] dark:hover:bg-[#2c2c33]";

const LinkRow = ({ link }: { link: string }) => {
    const [isCopied, setIsCopied] = useState(false);

    useEffect(() => {
        if (!isCopied) return;
        const timeout = setTimeout(() => setIsCopied(false), 2000);
        return () => clearTimeout(timeout);
    }, [isCopied]);

    const copy = async () => {
        if (await copyToClipboard(link)) setIsCopied(true);
        else toast.error("Could not copy the link, copy it from the field");
    };

    return (
        <div className="flex gap-2">
            <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl bg-black/[0.04] px-3 text-zinc-400 dark:bg-white/[0.06]">
                <Link className="h-4 w-4 shrink-0" />
                <input
                    readOnly
                    value={link}
                    aria-label="Link to the drawing"
                    onFocus={event => event.currentTarget.select()}
                    className="min-w-0 flex-1 bg-transparent text-[13px] text-zinc-600 outline-none dark:text-zinc-300"
                />
            </label>
            <button
                type="button"
                onClick={copy}
                className="flex h-10 w-[118px] shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1b1b1f] text-[13.5px] font-semibold text-white transition hover:bg-black active:scale-[0.98] dark:bg-white dark:text-[#1b1b1f] dark:hover:bg-zinc-200"
            >
                {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {isCopied ? "Copied" : "Copy link"}
            </button>
        </div>
    );
};

type AccessOptionsProps = {
    slug: string;
    linkAccess: LinkAccess;
    canChange: boolean;
};

const AccessOptions = ({ slug, linkAccess, canChange }: AccessOptionsProps) => {
    const utils = trpc.useUtils();
    const { handleError } = useError();

    const change = async (value: LinkAccess) => {
        if (value === linkAccess) return;
        const previous = utils.access.get.getData({ slug });
        utils.access.get.setData({ slug }, data => (data ? { ...data, linkAccess: value } : data));

        try {
            await utils.client.access.setLinkAccess.mutate({ slug, linkAccess: value });
        } catch (error) {
            utils.access.get.setData({ slug }, previous);
            await handleError(error, {
                toast: true,
                errorMessage: "Could not change who can open it",
            });
        }
        void utils.collection.get.invalidate();
    };

    return (
        <div role="radiogroup" aria-label="Who can open the link" className="grid gap-1.5">
            {OPTIONS.map(({ value, title, text, Icon }) => {
                const isSelected = value === linkAccess;
                return (
                    <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        disabled={!canChange && !isSelected}
                        onClick={() => canChange && void change(value)}
                        className={cn(
                            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                            canChange && "hover:bg-black/[0.04] dark:hover:bg-white/[0.05]",
                            !canChange && "cursor-default",
                            !canChange && !isSelected && "opacity-45",
                            isSelected &&
                                "bg-[#de9239]/[0.12] shadow-[inset_0_0_0_1.5px_rgba(222,146,57,0.55)] hover:bg-[#de9239]/[0.12] dark:hover:bg-[#de9239]/[0.12]"
                        )}
                    >
                        <span
                            className={cn(
                                "grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-black/[0.05] text-zinc-500 dark:bg-white/[0.07] dark:text-zinc-400",
                                isSelected &&
                                    "bg-[#de9239]/20 text-[#9a5512] dark:bg-[#de9239]/25 dark:text-[#f0a650]"
                            )}
                        >
                            <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1 leading-snug">
                            <span className="block text-[13.5px] font-semibold">{title}</span>
                            <span className="block text-[12.5px] text-zinc-500 dark:text-zinc-400">
                                {text}
                            </span>
                        </span>
                        {isSelected ? (
                            <Check className="h-4 w-4 shrink-0 text-[#c27526] dark:text-[#f0a650]" />
                        ) : null}
                    </button>
                );
            })}
        </div>
    );
};

const Note = ({ children }: { children: string }) => (
    <p className="mt-2.5 text-[12.5px] leading-snug text-zinc-500 dark:text-zinc-400">{children}</p>
);

/** Save the drawing to your collection, or a copy of it that's yours */
const CollectionButtons = ({ slug, onDone }: { slug: string; onDone: () => void }) => {
    const { isAuthenticated } = useAuth();
    const { data: collection } = useCollection();
    const { addDrawing } = useCollectionActions();
    const copyToCollection = useCopyToCollection();
    const setShowSignInModal = useSignInModalStore(s => s.setShowSignInModal);
    const [isBusy, setIsBusy] = useState(false);
    const isSaved = collection?.drawings.some(drawing => drawing.slug === slug) ?? false;

    const run = async (action: () => Promise<unknown>) => {
        setIsBusy(true);
        await action();
        setIsBusy(false);
    };

    const save = () =>
        run(async () => {
            if (!isAuthenticated) {
                onDone();
                setShowSignInModal(true);
                return;
            }
            if (await addDrawing(slug)) toast.success("Saved to your collection");
        });

    const copy = () =>
        run(async () => {
            onDone();
            await copyToCollection(slug);
        });

    return (
        <div className="flex gap-2">
            <button
                type="button"
                onClick={save}
                disabled={isBusy || isSaved}
                className={SECONDARY_BUTTON}
            >
                {isSaved ? (
                    <BookmarkCheck className="h-4 w-4" />
                ) : (
                    <BookmarkPlus className="h-4 w-4" />
                )}
                {isSaved ? "In your collection" : "Save to my collection"}
            </button>
            <button type="button" onClick={copy} disabled={isBusy} className={SECONDARY_BUTTON}>
                <CopyPlus className="h-4 w-4" />
                Copy to my collection
            </button>
        </div>
    );
};

const ShareDialog = ({ slug, onClose }: { slug: string; onClose: () => void }) => {
    const { data: access } = trpc.access.get.useQuery({ slug }, { retry: false });
    const link = `${window.location.origin}/draw/${slug}`;

    const renderNote = () => {
        if (!access) return null;
        if (!access.hasOwner) {
            return (
                <Note>
                    This drawing was made without signing in, so anyone with the link can edit it.
                    Copy it to your collection to choose who can open it.
                </Note>
            );
        }
        if (access.role !== "owner") return <Note>Only the owner can change who can open it.</Note>;
        return null;
    };

    return (
        <div
            role="dialog"
            aria-modal
            aria-labelledby="share-title"
            className="relative w-full max-w-[460px] rounded-[20px] bg-white p-6 text-[#1b1b1f] shadow-[0_30px_80px_-24px_rgba(20,20,50,0.5),0_0_0_1px_rgba(20,20,40,0.06)] duration-200 animate-in fade-in-0 zoom-in-[0.98] dark:bg-[#232329] dark:text-zinc-100 dark:shadow-[0_30px_80px_-24px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.08)] dark:[color-scheme:dark] sm:p-7"
        >
            <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="absolute right-3.5 top-3.5 grid h-8 w-8 place-items-center rounded-lg text-zinc-400 transition hover:bg-black/5 hover:text-zinc-700 dark:hover:bg-white/10 dark:hover:text-zinc-200"
            >
                <X className="h-[18px] w-[18px]" />
            </button>
            <h2
                id="share-title"
                className="font-['Bricolage_Grotesque_Variable',sans-serif] text-[24px] font-extrabold leading-[1.1] tracking-[-0.02em]"
            >
                Share drawing
            </h2>

            <div className="mt-5">
                <LinkRow link={link} />
            </div>

            <h3 className="mb-2 mt-6 text-[11px] font-bold uppercase tracking-[0.07em] text-zinc-400">
                Who can open the link
            </h3>
            {access ? (
                <AccessOptions
                    slug={slug}
                    linkAccess={access.linkAccess}
                    canChange={access.role === "owner"}
                />
            ) : (
                <div className="h-[196px] animate-pulse rounded-xl bg-black/[0.03] dark:bg-white/[0.03]" />
            )}
            {renderNote()}

            <div className="my-5 h-px bg-black/[0.07] dark:bg-white/[0.08]" />
            <CollectionButtons slug={slug} onDone={onClose} />
        </div>
    );
};

/** The share window, when it's open */
export const ShareDialogContainer = () => {
    const slug = useShareDialogStore(s => s.slug);
    const close = useShareDialogStore(s => s.close);

    if (!slug) return null;

    const onClose = () => {
        close();
        NativeContainer.parse();
        NativeContainer.focus();
    };

    return (
        <Modal.Container
            show
            setShow={show => !show && close()}
            onClose={() => {
                NativeContainer.parse();
                NativeContainer.focus();
            }}
            backgroundClassName="backdrop-blur-[3px] p-4"
        >
            <ShareDialog slug={slug} onClose={onClose} />
        </Modal.Container>
    );
};
