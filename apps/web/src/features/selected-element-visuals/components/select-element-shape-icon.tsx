import { CustomElementType } from "common";
import { LucideIcon } from "lucide-react";
import { cn } from "ui";

export const SelectElementShapeIcon = ({
    Icon,
    handleClick,
    type,
    isSelected,
}: {
    Icon: LucideIcon;
    handleClick: (type: CustomElementType) => void;
    type: CustomElementType;
    isSelected?: boolean;
}) => {
    const handleButtonClick = () => {
        handleClick(type);
    };

    return (
        <div
            className={cn(`p-1 border w-12 h-12 grid place-items-center rounded-lg 
            border-none focus:outline-none focus-visible:outline-none, ${
                isSelected
                    ? "bg-[#E0DFFF] dark:bg-[#3B3B3B]"
                    : "hover:bg-[#E0DFFF] dark:hover:bg-[#3B3B3B]"
            } `)}
            tabIndex={0}
            onClick={handleButtonClick}
            role="button"
        >
            <Icon className="w-8 h-8" />
        </div>
    );
};
