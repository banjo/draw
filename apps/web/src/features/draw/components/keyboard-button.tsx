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
            "flex items-center justify-center rounded-lg border-2 bg-[#FAFBFC] border-[#CED4DB] py-1 px-2",
            "select-none",
            className
        )}
    >
        {children}
    </button>
);
