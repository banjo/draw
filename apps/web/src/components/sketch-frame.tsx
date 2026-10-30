import { useLayoutEffect, useRef } from "react";
import rough from "roughjs";
import { cn } from "ui";

const INK = "#1e1e1e";

type Props = {
    fill?: string;
    stroke?: string;
    shape?: "rectangle" | "ellipse";
    radius?: number;
    roughness?: number;
    strokeWidth?: number;
    seed?: number;
    className?: string;
};

type Box = { x: number; y: number; w: number; h: number };

const roundedRect = ({ x, y, w, h }: Box, radius: number) => {
    const r = Math.min(radius, w / 2, h / 2);
    return `M${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} H${x + r} Q${x} ${y + h} ${x} ${y + h - r} V${y + r} Q${x} ${y} ${x + r} ${y} Z`;
};

/**
 * A hand-drawn outline and fill behind its parent's content, drawn with rough.js like the
 * canvas. The parent needs `relative isolate`. In dark mode it turns dark like the canvas.
 */
export const SketchFrame = ({
    fill,
    stroke = INK,
    shape = "rectangle",
    radius = 8,
    roughness = 0.8,
    strokeWidth = 1.4,
    seed = 1,
    className,
}: Props) => {
    const ref = useRef<SVGSVGElement>(null);

    useLayoutEffect(() => {
        const svg = ref.current;
        const parent = svg?.parentElement;
        if (!svg || !parent) return;

        const draw = () => {
            // The parent's size without transforms, as menus scale in while opening
            const width = parent.offsetWidth;
            const height = parent.offsetHeight;
            if (!width || !height) return;

            svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
            const rc = rough.svg(svg);
            const options = {
                seed,
                roughness,
                stroke,
                strokeWidth,
                fill,
                fillStyle: "solid",
                preserveVertices: true,
            };
            const inset = strokeWidth;
            const node =
                shape === "ellipse"
                    ? rc.ellipse(
                          width / 2,
                          height / 2,
                          width - inset * 2,
                          height - inset * 2,
                          options
                      )
                    : rc.path(
                          roundedRect(
                              { x: inset, y: inset, w: width - inset * 2, h: height - inset * 2 },
                              radius
                          ),
                          options
                      );
            svg.replaceChildren(node);
        };

        draw();
        const observer = new ResizeObserver(draw);
        observer.observe(parent);
        return () => observer.disconnect();
    }, [fill, stroke, shape, radius, roughness, strokeWidth, seed]);

    return (
        <svg
            ref={ref}
            aria-hidden
            className={cn(
                "pointer-events-none absolute inset-0 -z-10 h-full w-full overflow-visible dark:[filter:invert(93%)_hue-rotate(180deg)]",
                className
            )}
        />
    );
};
