import { PropsWithChildren } from "react";
import { cn } from "ui";

type Props = PropsWithChildren<{
    onClick: () => void;
    className?: string;
}>;

export const KeyboardButton = ({ onClick, children, className }: Props) => (
    <button
        onClick={onClick}
        className={cn(
            "flex items-center justify-center rounded-lg border-2 py-1 px-2",
            "select-none",
            "bg-[#FAFBFC] border-[#CED4DB] dark:bg-[#1E1E1E] dark:border-[#3A3A3A]",
            className
        )}
    >
        {children}
    </button>
);
