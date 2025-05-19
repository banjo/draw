import { isEmpty, noop } from "@banjoanton/utils";
import { FC } from "react";
import { cn } from "../../utils";
import { IconSize, iconSizeMapper, IconType } from "./icons";
import { Tooltip } from "./tooltip";
import React from "react";

type FilterIconProps = {
    Icon: IconType;
    tooltip?: string;
    className?: string;
    onClick?: React.MouseEventHandler;
    disabled?: boolean;
    size?: IconSize;
    enableTooltip?: boolean;
};

export const ResponsiveIcon: FC<FilterIconProps> = ({
    Icon,
    disabled,
    onClick = noop,
    tooltip,
    enableTooltip = true,
    size = "sm",
    className,
}) => (
    <Tooltip tooltip={tooltip} enabled={enableTooltip ? !isEmpty(tooltip) : null}>
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
