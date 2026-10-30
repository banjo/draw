import { CopyPlus, Eye } from "lucide-react";
import { useCopyToCollection } from "../hooks/use-copy-to-collection";

/** Shown at the top when you can only view the drawing, with a way to get a copy to edit */
export const ViewOnlyBadge = ({ slug }: { slug: string }) => {
    const copyToCollection = useCopyToCollection();

    return (
        <div className="flex h-9 items-center gap-1 rounded-lg bg-[--island-bg-color] p-1 pl-2.5 text-[13px] shadow-[0_0_0_1px_var(--color-surface-lowest),var(--shadow-island)]">
            <Eye className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
            <span className="mr-1 whitespace-nowrap font-semibold">View only</span>
            <button
                type="button"
                onClick={() => void copyToCollection(slug)}
                className="flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md bg-[#de9239]/15 px-2.5 font-semibold text-[#9a5512] transition hover:bg-[#de9239]/25 dark:text-[#f0a650]"
            >
                <CopyPlus className="h-3.5 w-3.5" />
                Make a copy to edit
            </button>
        </div>
    );
};
