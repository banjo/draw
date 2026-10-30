import { Sparkles } from "lucide-react";
import { cn } from "ui";
import { useIconImage } from "../hooks/use-icon-image";
import { Item } from "../models/add-element-item";
import { getIconSet, IconSetId } from "../models/icon-sets";
import { ElementSketch } from "./element-sketch";

type IconImageProps = { set: IconSetId; name: string; className?: string };

/** An Iconify icon, or a placeholder while it loads */
export const IconImage = ({ set, name, className }: IconImageProps) => {
    const image = useIconImage(set, name);

    if (!image || image === "missing") {
        return (
            <span
                className={cn(
                    "block rounded-md bg-black/[0.06] dark:bg-white/[0.08]",
                    !image && "animate-pulse",
                    className
                )}
            />
        );
    }

    return (
        <img
            src={image.dataUrl}
            alt=""
            draggable={false}
            className={cn(
                "object-contain",
                // Drawn in black, so light enough to see in dark mode
                getIconSet(set).monochrome && "dark:invert dark:opacity-90",
                className
            )}
        />
    );
};

/** The small picture in front of a row */
export const ItemThumb = ({ item }: { item: Item }) => (
    <span className="grid h-8 w-10 shrink-0 place-items-center rounded-lg bg-black/[0.035] text-[#1e1e1e] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)] dark:bg-white/[0.05] dark:text-[#d8d8d8] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
        {item.kind === "element" ? <ElementSketch type={item.shape.type} /> : null}
        {item.kind === "browse" ? (
            <IconImage set={item.icon.set} name={item.icon.name} className="h-5 w-5" />
        ) : null}
        {item.kind === "icon" ? (
            <IconImage set={item.set} name={item.name} className="h-5 w-5" />
        ) : null}
        {item.kind === "ai" && item.mode === "diagram" ? (
            <Sparkles className="h-[18px] w-[18px] text-[#b4529c] dark:text-[#f09ad8]" />
        ) : null}
        {item.kind === "ai" && item.mode === "mermaid" ? <ElementSketch type="mermaid" /> : null}
    </span>
);
