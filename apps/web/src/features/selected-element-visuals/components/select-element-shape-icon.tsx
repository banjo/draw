import { ElementType } from "@/features/draw/utils/element-creation-util";
import { LucideIcon } from "lucide-react";
import { cn } from "ui";

export const SelectElementShapeIcon = ({
    Icon,
    handleClick,
    type,
    isSelected,
}: {
    Icon: LucideIcon;
    handleClick: (type: ElementType) => void;
    type: ElementType;
    isSelected?: boolean;
}) => {
    const handleButtonClick = () => {
        handleClick(type);
    };

    return (
        <div
            className={cn(`p-1 border w-12 h-12 grid place-items-center rounded-lg 
            border-none focus:outline-none focus-visible:outline-none, ${
                isSelected ? "bg-[#E0DFFF]" : "hover:bg-[#E0DFFF]"
            } `)}
            tabIndex={0}
            onClick={handleButtonClick}
            role="button"
        >
            <Icon className="w-8 h-8" />
        </div>
    );
};
