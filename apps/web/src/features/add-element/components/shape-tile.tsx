import { Highlight } from "@/features/collection/components/highlight";
import { Shape } from "@/models/shapes";
import { MouseEvent } from "react";
import { cn } from "ui";
import { ElementSketch } from "./element-sketch";

type Props = {
    shape: Shape;
    query?: string;
    isSelected: boolean;
    /** The type the selected shape has now, when changing it */
    isCurrent?: boolean;
    onHover: () => void;
    onClick: (event: MouseEvent) => void;
};

/** A shape or block in a grid: its sketch, with its name under it */
export const ShapeTile = ({
    shape,
    query = "",
    isSelected,
    isCurrent,
    onHover,
    onClick,
}: Props) => {
    const title = shape.title ?? shape.type;

    return (
        <div
            role="option"
            aria-selected={isSelected}
            aria-label={isCurrent ? `${title} (current)` : title}
            title={shape.description}
            onMouseMove={() => !isSelected && onHover()}
            onMouseDown={event => event.preventDefault()}
            onClick={onClick}
            className={cn(
                "relative flex h-[60px] min-w-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg bg-black/[0.03] text-[#1e1e1e] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)] transition-colors hover:bg-black/[0.06] dark:bg-white/[0.04] dark:text-[#d8d8d8] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] dark:hover:bg-white/[0.08]",
                isSelected &&
                    "bg-[#ecebff] shadow-[inset_0_0_0_2px_#6965db] dark:bg-[#a8a5ff]/15 dark:shadow-[inset_0_0_0_2px_#a8a5ff]"
            )}
        >
            {isCurrent ? (
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#de9239]" />
            ) : null}
            <ElementSketch type={shape.type} />
            <span
                className={cn(
                    "max-w-full truncate px-0.5 text-[10.5px] font-medium text-zinc-600 dark:text-zinc-300",
                    isSelected && "text-[#4a47b1] dark:text-[#b7b5ff]"
                )}
            >
                <Highlight text={title} query={query} />
            </span>
        </div>
    );
};
