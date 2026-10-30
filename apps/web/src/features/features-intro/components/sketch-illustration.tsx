import { drawIllustration } from "@/features/features-intro/models/illustrations";
import { useEffect, useRef } from "react";
import { cn } from "ui";

type Props = {
    id: string;
    seed?: number;
    className?: string;
};

/** A hand-drawn picture from `illustrations.ts`, dark in dark mode like the canvas */
export const SketchIllustration = ({ id, seed = 1, className }: Props) => {
    const ref = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (ref.current) drawIllustration(id, ref.current, seed);
    }, [id, seed]);

    return (
        <svg
            ref={ref}
            aria-hidden
            preserveAspectRatio="xMidYMid meet"
            className={cn("h-full w-full dark:[filter:invert(93%)_hue-rotate(180deg)]", className)}
        />
    );
};
