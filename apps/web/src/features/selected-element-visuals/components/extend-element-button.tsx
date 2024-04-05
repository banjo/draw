import { Callback } from "@banjoanton/utils";
import { LucideIcon } from "lucide-react";
import { cn } from "ui";

type Props = {
    customRef: React.RefObject<HTMLDivElement>;
    Icon: LucideIcon;
    onMouseEnter?: Callback;
    onMouseLeave?: Callback;
    onClick?: Callback;
};

export const ExtendElementButton = ({
    customRef,
    Icon,
    onClick,
    onMouseEnter,
    onMouseLeave,
}: Props) => {
    return (
        <div
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onClick={onClick}
            ref={customRef}
            className={cn(
                "absolute z-[3] hover:cursor-pointer w-4 h-4 flex justify-center items-center hover:scale-150 transition-transform"
            )}
        >
            <Icon className="stroke-slate-600 hover:opacity-30" />
        </div>
    );
};
