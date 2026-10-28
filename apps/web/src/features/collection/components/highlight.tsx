import { matchesQuery } from "@/features/collection/models/collection-tree";

/** The text, with the part matching the query marked */
export const Highlight = ({ text, query }: { text: string; query: string }) => {
    const trimmed = query.trim();
    if (!trimmed || !matchesQuery(text, trimmed)) return text;

    const start = text.toLocaleLowerCase().indexOf(trimmed.toLocaleLowerCase());
    const end = start + trimmed.length;
    return (
        <>
            {text.slice(0, start)}
            <mark className="rounded-sm bg-yellow-200/80 text-inherit dark:bg-yellow-500/40">
                {text.slice(start, end)}
            </mark>
            {text.slice(end)}
        </>
    );
};
