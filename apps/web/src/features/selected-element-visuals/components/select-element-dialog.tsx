import { SelectElementShapeContainer } from "@/features/selected-element-visuals/components/select-element-shape-container";
import { Callback } from "@banjoanton/utils";
import React from "react";

type Props = {
    customRef: React.RefObject<HTMLDivElement>;
    closeSelectElementDialog: Callback;
};

export const SelectElementDialog = ({ customRef, closeSelectElementDialog }: Props) => (
    <div
        ref={customRef}
        className="absolute z-[4] flex p-2 
                        bg-white dark:bg-gray-800 border shadow-lg
                        rounded-md font-thin text-xs text-[#1B1B1F] dark:text-white hover:cursor-pointer"
    >
        <SelectElementShapeContainer closeSelectElementDialog={closeSelectElementDialog} />
    </div>
);
