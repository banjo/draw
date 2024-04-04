import { SelectElementShapeContainer } from "@/features/selected-element-visuals/components/select-element-shape-container";
import { Callback, Maybe } from "@banjoanton/utils";
import { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";

type Props = {
    customRef: React.RefObject<HTMLDivElement>;
    excalidrawApi: Maybe<ExcalidrawImperativeAPI>;
    closeSelectElementDialog: Callback;
};

export const SelectElementDialog = ({
    customRef,
    excalidrawApi,
    closeSelectElementDialog,
}: Props) => {
    return (
        <div
            ref={customRef}
            className="absolute z-[3] flex p-2 
                        bg-white border shadow-lg
                        rounded-md font-thin text-xs text-[#1B1B1F] hover:cursor-pointer"
        >
            <SelectElementShapeContainer
                closeSelectElementDialog={closeSelectElementDialog}
                excalidrawApi={excalidrawApi}
            />
        </div>
    );
};
