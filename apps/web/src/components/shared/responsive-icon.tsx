import { IconSize, iconSizeMapper } from "@/components/shared/icons";
import { Tooltip } from "@/components/shared/tooltip";
import { cn } from "@/lib/utils";
import { noop } from "@banjoanton/utils";
import { FC } from "react";

export type Icon = FC<{ className: string; onClick: () => void; disabled: boolean }>;

type FilterIconProps = {
    Icon: Icon;
    tooltip?: string;
    className?: string;
    onClick?: () => void;
    disabled?: boolean;
    size?: IconSize;
    enableTooltip?: boolean;
};

export const ResponsiveIcon: FC<FilterIconProps> = ({
    Icon,
    disabled,
    onClick = noop,
    tooltip,
    enableTooltip = false,
    size = "sm",
    className,
}) => {
    return (
        <Tooltip tooltip={tooltip} enabled={enableTooltip}>
            <Icon
                className={cn(
                    `${iconSizeMapper[size]} 
                    active:opacity-40 
                    ${disabled ? "opacity-30" : "cursor-pointer hover:opacity-70 outline-none"}`,
                    className
                )}
                onClick={disabled ? noop : onClick}
                disabled={disabled ?? false}
            />
        </Tooltip>
    );
};
