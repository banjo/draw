import { SketchFrame } from "@/components/sketch-frame";
import { SKETCH, SKETCH_TEXT } from "@/models/brand";
import { cn } from "ui";

/** "Pro", hand-drawn in a strong orange and a little tilted so it stands out, or "Free" */
export const PlanBadge = ({ plan }: { plan: "free" | "pro" }) =>
    plan === "pro" ? (
        <span
            className={cn(
                "relative isolate inline-flex h-[22px] -rotate-3 items-center px-2 pt-px font-['Excalifont',cursive] text-[15px] leading-none",
                SKETCH_TEXT
            )}
        >
            <SketchFrame fill={SKETCH.strong} radius={4} roughness={1} strokeWidth={1.6} seed={7} />
            Pro
        </span>
    ) : (
        <span className="relative isolate inline-flex h-[22px] items-center px-2 pt-px font-['Excalifont',cursive] text-[15px] leading-none text-zinc-500 dark:text-zinc-400">
            <SketchFrame stroke="#9a9aa6" radius={4} strokeWidth={1.2} seed={8} />
            Free
        </span>
    );
