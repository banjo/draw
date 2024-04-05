import { SelectElementShapeContainer } from "@/features/selected-element-visuals/components/select-element-shape-container";
import { Callback } from "@banjoanton/utils";

type Props = {
    customRef: React.RefObject<HTMLDivElement>;
    closeSelectElementDialog: Callback;
};

export const SelectElementDialog = ({ customRef, closeSelectElementDialog }: Props) => {
    return (
        <div
            ref={customRef}
            className="absolute z-[4] flex p-2 
                        bg-white border shadow-lg
                        rounded-md font-thin text-xs text-[#1B1B1F] hover:cursor-pointer"
        >
            <SelectElementShapeContainer closeSelectElementDialog={closeSelectElementDialog} />
        </div>
    );
};
