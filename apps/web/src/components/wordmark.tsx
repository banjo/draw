import { cn } from "ui";

type Props = {
    /** "logo" has the icon in front, "name" is only the name */
    variant?: "logo" | "name";
    className?: string;
};

/**
 * "banjodraw" in Excalifont, with an orange pencil line under "draw". The files in public/
 * are made from the font, so they look the same everywhere, also as plain images.
 */
export const Wordmark = ({ variant = "logo", className }: Props) => (
    <span className={cn("inline-block", className)}>
        <img
            src={`/banjodraw-${variant}.svg`}
            alt="banjodraw"
            className="block h-full w-auto dark:hidden"
        />
        <img
            src={`/banjodraw-${variant}-dark.svg`}
            alt="banjodraw"
            className="hidden h-full w-auto dark:block"
        />
    </span>
);
