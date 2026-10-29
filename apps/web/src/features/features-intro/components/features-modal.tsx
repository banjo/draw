import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/hanken-grotesk";
import { Modal } from "@/components/modal";
import { NativeContainer } from "@/features/draw/models/native/native-container";
import { Feature, FEATURES } from "@/features/features-intro/models/features";
import { drawIllustration } from "@/features/features-intro/models/illustrations";
import { SeenFeatures } from "@/features/features-intro/models/seen-features";
import { FeaturesModalMode } from "@/features/features-intro/stores/use-features-modal-store";
import { useEffect, useMemo, useRef } from "react";
import { cn } from "ui";

type Props = {
    mode: FeaturesModalMode;
    onClose: () => void;
};

/** "few": one to three cards, side by side with their full description */
type CardSize = "hero" | "wide" | "single" | "few";

// Written out, so Tailwind finds the classes
const FEW_WIDTHS: Record<number, string> = {
    1: "max-w-[560px]",
    2: "max-w-[820px]",
    3: "max-w-[1040px]",
};
const FEW_COLUMNS: Record<number, string> = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3" };

const DISPLAY_FONT = "font-['Bricolage_Grotesque_Variable',sans-serif]";

// The stroke in the logo, public/banjodraw.svg
const LOGO_STROKE = "M26 84 C34 54 50 38 60 48 C70 58 46 80 58 88 C68 94 84 70 94 40";

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

/**
 * Each card's size: the important ones big, the others single. The last single cards widen
 * to fill the last row. A few cards share the space equally.
 */
const getSizes = (features: Feature[]): CardSize[] => {
    if (features.length < 4) return features.map(() => "few");
    const sizes = features.map(feature => feature.size ?? "single");
    const cells = sizes.reduce((sum, size) => sum + CELLS[size], 0);
    let emptyCells = (COLUMNS - (cells % COLUMNS)) % COLUMNS;
    for (let i = sizes.length - 1; i >= 0 && emptyCells > 0; i--) {
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

const Illustration = ({ id, seed }: { id: string; seed: number }) => {
    const ref = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (ref.current) drawIllustration(id, ref.current, seed);
    }, [id, seed]);

    return (
        <svg
            ref={ref}
            aria-hidden
            preserveAspectRatio="xMidYMid meet"
            // Excalidraw's dark mode filter, like the canvas
            className="h-full w-full dark:[filter:invert(93%)_hue-rotate(180deg)]"
        />
    );
};

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
                <Illustration id={feature.id} seed={index + 3} />
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

/** The features BanjoDraw adds, shown once to new visitors and when new ones are added */
export const FeaturesModal = ({ mode, onClose }: Props) => {
    // Read when it opens, as closing marks them as seen
    const features = useMemo(() => (mode === "all" ? FEATURES : SeenFeatures.getUnseen()), [mode]);
    const isFirstVisit = useMemo(() => SeenFeatures.getSeenIds().length === 0, []);
    const { lead, accent, sub } = getHeading(mode, isFirstVisit);
    const isFew = features.length < 4;
    const sizes = useMemo(() => getSizes(features), [features]);

    const close = () => {
        SeenFeatures.markSeen(features);
        onClose();
        NativeContainer.parse();
        NativeContainer.focus();
    };

    return (
        <Modal.Container show setShow={close} backgroundClassName="backdrop-blur-[3px] p-4">
            <div
                className={cn(
                    "max-h-[calc(100dvh-32px)] w-full overflow-y-auto rounded-[26px] bg-[#fbfbfd]",
                    "font-['Hanken_Grotesk_Variable',sans-serif] text-[#1b1b1f] dark:bg-[#141418] dark:text-[#ececf1]",
                    "shadow-[0_50px_120px_-30px_rgba(25,25,60,0.45),0_0_0_1px_rgba(20,20,40,0.06)] dark:shadow-[0_50px_120px_-30px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.06)]",
                    "animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 duration-500",
                    FEW_WIDTHS[features.length] ?? "max-w-[1180px]"
                )}
                role="dialog"
                aria-modal
                aria-labelledby="features-title"
            >
                <header className="relative flex flex-wrap items-center justify-between gap-5 overflow-hidden bg-[#de9239] px-5 py-6 text-white sm:px-[30px] dark:bg-[#b8701f]">
                    <svg
                        aria-hidden
                        viewBox="0 0 120 120"
                        className="pointer-events-none absolute -right-1.5 -top-6 h-[190px] w-[190px] opacity-30"
                    >
                        <path
                            d={LOGO_STROKE}
                            fill="none"
                            stroke="white"
                            strokeWidth={9}
                            strokeLinecap="round"
                        />
                    </svg>
                    <div className="relative flex items-center gap-4">
                        <img
                            src="/banjodraw.svg"
                            alt=""
                            className="hidden h-14 w-14 shrink-0 rounded-[15px] ring-[3px] ring-white/55 sm:block"
                        />
                        <div>
                            <h2
                                id="features-title"
                                className={cn(
                                    DISPLAY_FONT,
                                    "text-[34px] font-extrabold leading-[0.95] tracking-[-0.035em] sm:text-[44px]"
                                )}
                            >
                                {lead} {accent}
                            </h2>
                            <p className="mt-2.5 text-base text-white/85">{sub}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={close}
                        className="relative whitespace-nowrap rounded-[14px] bg-white px-5 py-3 text-[15px] font-semibold text-[#9a5512] transition active:scale-[0.97]"
                    >
                        {isFirstVisit && mode === "new" ? "Start drawing" : "Got it"}
                    </button>
                </header>
                <div
                    className={cn(
                        "grid gap-3 p-4 sm:p-[22px] sm:pt-5",
                        isFew
                            ? cn("auto-rows-[360px] grid-cols-1", FEW_COLUMNS[features.length])
                            : "auto-rows-[176px] grid-flow-row-dense grid-cols-1 sm:grid-cols-2 lg:grid-cols-5"
                    )}
                >
                    {features.map((feature, index) => (
                        <FeatureCard
                            key={feature.id}
                            feature={feature}
                            index={index}
                            size={sizes[index] ?? "single"}
                        />
                    ))}
                </div>
            </div>
        </Modal.Container>
    );
};
