import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/hanken-grotesk";
import { Modal } from "@/components/modal";
import { SketchFrame } from "@/components/sketch-frame";
import { Wordmark } from "@/components/wordmark";
import { PEACH_BACKGROUND, SKETCH, SKETCH_TEXT } from "@/models/brand";
import { NativeContainer } from "@/features/draw/models/native/native-container";
import { Feature, FEATURES } from "@/features/features-intro/models/features";
import { SketchIllustration } from "@/features/features-intro/components/sketch-illustration";
import { SeenFeatures } from "@/features/features-intro/models/seen-features";
import { FeaturesModalMode } from "@/features/features-intro/stores/use-features-modal-store";
import { useMemo, useState } from "react";
import { cn } from "ui";

type Props = {
    mode: FeaturesModalMode;
    onClose: () => void;
};

/** "few": one to four cards, side by side with their full description */
type CardSize = "hero" | "wide" | "single" | "few";

// Written out, so Tailwind finds the classes
const FEW_WIDTHS: Record<number, string> = {
    1: "max-w-[560px]",
    2: "max-w-[820px]",
    3: "max-w-[1040px]",
};
const FEW_COLUMNS: Record<number, string> = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-3",
};

const DISPLAY_FONT = "font-['Bricolage_Grotesque_Variable',sans-serif]";

const getHeading = (mode: FeaturesModalMode, isFirstVisit: boolean) => {
    if (mode === "all") {
        return { lead: "What's in", accent: "BanjoDraw", sub: "Excalidraw, with a few extras." };
    }

    return isFirstVisit
        ? { lead: "Welcome to", accent: "BanjoDraw", sub: "It's Excalidraw, with a few extras." }
        : { lead: "What's", accent: "new", sub: "New in BanjoDraw since your last visit." };
};

// Five, so every feature fits on screen without scrolling
const COLUMNS = 5;

const CELLS: Record<Exclude<CardSize, "few">, number> = { hero: 4, wide: 2, single: 1 };
// Three rows a page, so a page fits on screen
const PAGE_CELLS = COLUMNS * 3;

/** A few cards, or only big ones, share the space equally, with their full description */
const isFewCards = (features: Feature[]) =>
    features.length < 4 || features.every(feature => feature.size === "hero");

const chunk = <T,>(items: T[], size: number) =>
    Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
        items.slice(i * size, (i + 1) * size)
    );

/**
 * All on one page when they fit in three rows. Else the most important ones first, side by
 * side, and the others on the pages after.
 */
const getPages = (features: Feature[]): Feature[][] => {
    const cells = features.reduce((sum, feature) => sum + CELLS[feature.size ?? "single"], 0);
    if (cells <= PAGE_CELLS) return [features];

    const big = features.filter(feature => feature.size === "hero");
    const others = features.filter(feature => feature.size !== "hero");
    return [...chunk(big, 3), ...chunk(others, PAGE_CELLS - COLUMNS)].filter(
        page => page.length > 0
    );
};

/**
 * Each card's size: the important ones big, the others single. Some single cards widen to
 * fill the last row. A few cards share the space equally.
 */
const getSizes = (features: Feature[]): CardSize[] => {
    if (isFewCards(features)) return features.map(() => "few");
    const sizes = features.map(feature => feature.size ?? "single");
    const cells = sizes.reduce((sum, size) => sum + CELLS[size], 0);
    let emptyCells = (COLUMNS - (cells % COLUMNS)) % COLUMNS;
    // After big cards, the last ones widen to fill the last row. Without, the first ones do,
    // as wide cards first leave no gaps.
    const order = sizes.map((_, i) => i);
    if (sizes.some(size => size !== "single")) order.reverse();
    for (const i of order) {
        if (emptyCells === 0) break;
        if (sizes[i] !== "single") continue;
        sizes[i] = "wide";
        emptyCells--;
    }
    return sizes;
};

const Keys = ({ keys }: { keys: string[] }) => (
    <span className="flex shrink-0 gap-1">
        {keys.map(key => (
            <kbd
                key={key}
                className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-md border border-[#dcdce4] bg-white px-1.5 font-sans text-[11px] font-semibold text-[#2b2b33] shadow-[0_1px_0_#d0d0da] dark:border-[#3a3a44] dark:bg-[#26262d] dark:text-[#e6e6ee] dark:shadow-[0_1px_0_#17171c]"
            >
                {key}
            </kbd>
        ))}
    </span>
);

const FeatureCard = ({
    feature,
    size,
    index,
}: {
    feature: Feature;
    size: CardSize;
    index: number;
}) => {
    const isHero = size === "hero";
    const isWide = size === "wide";
    const isFew = size === "few";

    return (
        <article
            style={{ animationDelay: `${80 + index * 45}ms` }}
            className={cn(
                "group flex overflow-hidden rounded-[18px] bg-white ring-1 ring-black/[0.07] transition duration-200",
                "animate-in fade-in-0 slide-in-from-bottom-3 fill-mode-backwards duration-500",
                "hover:-translate-y-[3px] hover:shadow-[0_18px_40px_-16px_rgba(180,110,30,0.4)] hover:ring-[#de9239]/45",
                "dark:bg-[#1c1c22] dark:ring-white/[0.06]",
                isHero && "row-span-2 sm:col-span-2",
                isWide ? "flex-row sm:col-span-2" : "flex-col"
            )}
        >
            <div
                className={cn("min-h-0 flex-1 p-3", isHero && "p-6", isWide && "order-2 basis-1/2")}
            >
                <SketchIllustration id={feature.id} seed={index + 3} />
            </div>
            <div
                className={cn(
                    "px-4 pb-4 pt-1",
                    (isHero || isFew) && "px-6 pb-6",
                    isWide && "flex basis-1/2 flex-col justify-center pt-4"
                )}
            >
                <h3
                    className={cn(
                        DISPLAY_FONT,
                        "flex items-center justify-between gap-2 text-[15.5px] font-bold leading-tight tracking-[-0.01em]",
                        isHero && "text-[22px]",
                        isFew && "text-[18px]"
                    )}
                >
                    {feature.title}
                    {feature.keys ? <Keys keys={feature.keys} /> : null}
                </h3>
                <p
                    className={cn(
                        "mt-1.5 text-[13.5px] leading-snug text-[#6c6c78] dark:text-[#9d9daa]",
                        (isHero || isFew) && "text-[15px] leading-relaxed"
                    )}
                >
                    {isHero || isFew ? feature.description : feature.short}
                </p>
            </div>
        </article>
    );
};

const PageNav = ({
    count,
    index,
    onChange,
}: {
    count: number;
    index: number;
    onChange: (index: number) => void;
}) => (
    <nav
        aria-label="Pages"
        className="flex items-center justify-between gap-3 px-4 pb-4 sm:px-[22px] sm:pb-[22px]"
    >
        <button
            type="button"
            onClick={() => onChange(index - 1)}
            disabled={index === 0}
            className="rounded-[12px] px-4 py-2 text-[14px] font-semibold text-zinc-600 transition hover:bg-black/5 disabled:invisible dark:text-zinc-300 dark:hover:bg-white/10"
        >
            ← Back
        </button>
        <div className="flex gap-2">
            {Array.from({ length: count }, (_, i) => (
                <button
                    key={i}
                    type="button"
                    aria-label={`Page ${i + 1}`}
                    aria-current={i === index ? "page" : undefined}
                    onClick={() => onChange(i)}
                    className={cn(
                        "h-2.5 rounded-full transition-all",
                        i === index
                            ? "w-7 bg-[#ffa94d] ring-1 ring-inset ring-black/40 dark:bg-[#c2702a] dark:ring-white/30"
                            : "w-2.5 bg-black/15 hover:bg-black/25 dark:bg-white/20"
                    )}
                />
            ))}
        </div>
        <button
            type="button"
            onClick={() => onChange(index + 1)}
            disabled={index === count - 1}
            className={cn(
                "relative isolate px-4 py-2 text-[14px] font-semibold transition active:scale-[0.97] disabled:invisible",
                SKETCH_TEXT
            )}
        >
            <SketchFrame fill={SKETCH.pastel} radius={10} seed={index + 11} />
            More →
        </button>
    </nav>
);

/** The features BanjoDraw adds, shown once to new visitors and when new ones are added */
export const FeaturesModal = ({ mode, onClose }: Props) => {
    // Read when it opens, as closing marks them as seen
    const features = useMemo(() => (mode === "all" ? FEATURES : SeenFeatures.getUnseen()), [mode]);
    const isFirstVisit = useMemo(() => SeenFeatures.getSeenIds().length === 0, []);
    const { lead, accent, sub } = getHeading(mode, isFirstVisit);
    const pages = useMemo(() => getPages(features), [features]);
    const [pageIndex, setPageIndex] = useState(0);
    const page = pages[pageIndex] ?? [];
    const isPaged = pages.length > 1;
    const isFew = isFewCards(page);
    const sizes = useMemo(() => getSizes(page), [page]);

    const hasDoodles = isPaged || features.length > 1;

    const goTo = (index: number) => setPageIndex(Math.min(Math.max(index, 0), pages.length - 1));

    const close = () => {
        SeenFeatures.markSeen(features);
        onClose();
        NativeContainer.parse();
        NativeContainer.focus();
    };

    return (
        <Modal.Container
            show
            setShow={close}
            backgroundClassName="backdrop-blur-[3px] p-4"
            onKeyDown={event => {
                if (event.key === "ArrowRight") goTo(pageIndex + 1);
                if (event.key === "ArrowLeft") goTo(pageIndex - 1);
            }}
        >
            <div
                className={cn(
                    "max-h-[calc(100dvh-32px)] w-full overflow-y-auto rounded-[26px] bg-[#fbfbfd]",
                    "font-['Hanken_Grotesk_Variable',sans-serif] text-[#1b1b1f] dark:bg-[#141418] dark:text-[#ececf1]",
                    "shadow-[0_50px_120px_-30px_rgba(25,25,60,0.45),0_0_0_1px_rgba(20,20,40,0.06)] dark:shadow-[0_50px_120px_-30px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.06)]",
                    "animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 duration-500",
                    (!isPaged && FEW_WIDTHS[features.length]) || "max-w-[1180px]"
                )}
                role="dialog"
                aria-modal
                aria-labelledby="features-title"
            >
                <header
                    className={cn(
                        "relative isolate flex flex-wrap items-center justify-between gap-5 overflow-hidden px-5 py-6 sm:px-[30px]",
                        // Room for the doodles, when it is wide enough
                        hasDoodles && "lg:pr-[290px]",
                        PEACH_BACKGROUND
                    )}
                >
                    {hasDoodles ? (
                        <SketchIllustration
                            id="doodles"
                            seed={5}
                            className="pointer-events-none absolute right-8 top-4 -z-10 hidden !h-[calc(100%-32px)] !w-[220px] lg:block"
                        />
                    ) : null}
                    <div className="flex items-center gap-4">
                        <img
                            src="/banjodraw.svg"
                            alt=""
                            className="hidden h-14 w-14 shrink-0 -rotate-3 sm:block"
                        />
                        <div>
                            <h2
                                id="features-title"
                                className={cn(
                                    DISPLAY_FONT,
                                    "text-[34px] font-extrabold leading-[0.95] tracking-[-0.035em] sm:text-[44px]"
                                )}
                            >
                                {lead}{" "}
                                {accent === "BanjoDraw" ? (
                                    <Wordmark
                                        variant="name"
                                        // Its baseline is 65% down, so the rest hangs below the line
                                        className="h-[38px] align-[-13px] sm:h-[50px] sm:align-[-17px]"
                                    />
                                ) : (
                                    <span className="font-['Excalifont',cursive] font-normal tracking-normal text-[#c2603a] dark:text-[#f0a650]">
                                        {accent}
                                    </span>
                                )}
                            </h2>
                            <p className="mt-2.5 text-base text-zinc-600 dark:text-zinc-400">
                                {sub}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={close}
                        className={cn(
                            "relative isolate whitespace-nowrap px-5 py-3 text-[15px] font-semibold transition active:scale-[0.97]",
                            SKETCH_TEXT
                        )}
                    >
                        <SketchFrame fill={SKETCH.pastel} radius={12} strokeWidth={1.6} seed={4} />
                        {isFirstVisit && mode === "new" ? "Start drawing" : "Got it"}
                    </button>
                </header>
                <div
                    key={pageIndex}
                    className={cn(
                        "grid gap-3 p-4 sm:p-[22px] sm:pt-5",
                        isFew
                            ? cn("auto-rows-[360px] grid-cols-1", FEW_COLUMNS[page.length])
                            : "auto-rows-[176px] grid-flow-row-dense grid-cols-1 sm:grid-cols-2 lg:grid-cols-5"
                    )}
                >
                    {page.map((feature, index) => (
                        <FeatureCard
                            key={feature.id}
                            feature={feature}
                            index={index}
                            size={sizes[index] ?? "single"}
                        />
                    ))}
                </div>
                {isPaged ? (
                    <PageNav count={pages.length} index={pageIndex} onChange={goTo} />
                ) : null}
            </div>
        </Modal.Container>
    );
};
