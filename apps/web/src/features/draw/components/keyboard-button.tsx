import { PropsWithChildren } from "react";
import { cn } from "ui";

type Props = PropsWithChildren<{
    onClick: () => void;
    customRef: React.RefObject<HTMLButtonElement>;
    className?: string;
}>;

export const KeyboardButton = ({ onClick, children, customRef, className }: Props) => {
    return (
        <button
            onClick={onClick}
            ref={customRef}
            className={cn(
                "flex items-center justify-center rounded-lg border-2 bg-[#FAFBFC] border-[#CED4DB] py-1 px-2",
                className
            )}
        >
            {children}
        </button>
    );
};
