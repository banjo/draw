import { renderDrawingPreview } from "@/features/collection/models/drawing-preview";
import { trpc } from "@/lib/trpc";
import { useTheme } from "@/providers/theme-provider";
import { useDebounce } from "@uidotdev/usehooks";
import { useEffect, useRef, useState } from "react";

type Preview = { slug: string; svg: SVGSVGElement | null };

/** A drawing, loaded and drawn when it's been selected for a moment */
export const DrawingPreview = ({ slug }: { slug: string }) => {
    const debouncedSlug = useDebounce(slug, 150);
    const { data, isError } = trpc.draw.getDrawing.useQuery(
        { slug: debouncedSlug },
        { staleTime: 60_000, retry: false }
    );
    const { resolvedTheme } = useTheme();
    const [preview, setPreview] = useState<Preview | null>(null);
    const container = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!data) return;
        let isCancelled = false;
        void renderDrawingPreview(data, resolvedTheme === "dark").then(svg => {
            if (!isCancelled) setPreview({ slug: debouncedSlug, svg });
        });
        return () => {
            isCancelled = true;
        };
    }, [data, debouncedSlug, resolvedTheme]);

    const current = preview?.slug === slug ? preview : null;

    useEffect(() => {
        container.current?.replaceChildren(...(current?.svg ? [current.svg] : []));
    }, [current]);

    let message: string | null = null;
    if (isError && debouncedSlug === slug) message = "No preview";
    else if (current && !current.svg) message = "Empty drawing";

    return (
        <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-white ring-1 ring-black/[0.08] dark:bg-[#121212] dark:ring-white/[0.08]">
            <div ref={container} className="absolute inset-0" />
            {!current && !message ? (
                <div className="absolute inset-0 animate-pulse bg-black/[0.03] dark:bg-white/[0.03]" />
            ) : null}
            {message ? (
                <div className="absolute inset-0 grid place-items-center text-sm text-zinc-400">
                    {message}
                </div>
            ) : null}
        </div>
    );
};
