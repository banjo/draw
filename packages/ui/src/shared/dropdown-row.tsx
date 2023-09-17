import { FC, ReactNode } from "react";
import { Icon, ResponsiveIcon } from "./responsive-icon";

type Props = {
    icon: Icon;
    text: ReactNode;
};

export const DropdownRow: FC<Props> = ({ icon, text }) => {
    return (
        <div className="flex items-center">
            <ResponsiveIcon Icon={icon} enableTooltip={false} size="xs" />
            <span className="ml-2">{text}</span>
        </div>
    );
};
