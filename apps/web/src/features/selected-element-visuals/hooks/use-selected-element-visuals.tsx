import { OnChangeCallback } from "@/features/draw/draw";
import { DrawingUtil } from "@/features/draw/utils/drawing-util";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { ChangeElementDialog } from "@/features/selected-element-visuals/components/change-element-dialog";
import { SelectElementDialog } from "@/features/selected-element-visuals/components/select-element-dialog";
import { useChangeElementDialog } from "@/features/selected-element-visuals/hooks/use-change-element-dialog";
import { useSelectElementDialog } from "@/features/selected-element-visuals/hooks/use-select-element-dialog";
import { useChangeElementStore } from "@/stores/use-change-element-store";
import { Maybe, first } from "@banjoanton/utils";
import { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";

type In = {
    excalidrawApi: Maybe<ExcalidrawImperativeAPI>;
};

export const useSelectedElementVisuals = ({ excalidrawApi }: In) => {
    const {
        changeElementRef,
        setShowChangeElementDialog,
        showChangeElementDialog,
        applyPosition: applyChangeElementPosition,
    } = useChangeElementDialog({ excalidrawApi });

    const {
        selectElementRef,
        setShowSelectElementDialog,
        showSelectElementDialog,
        applyPosition: applySelectElementPosition,
    } = useSelectElementDialog({ excalidrawApi });

    const metaKeyIsDown = useChangeElementStore(s => s.metaKeyIsDown);

    const handleSelectedElementVisuals: OnChangeCallback = (elements, appState) => {
        if (!excalidrawApi) return;

        const selected = ElementUtil.getSelectedElements(appState, elements);

        if (selected.length !== 1) {
            setShowChangeElementDialog(false);
            setShowSelectElementDialog(false);
            return;
        }

        const selectedElement = first(selected);

        if (!selectedElement) {
            setShowChangeElementDialog(false);
            setShowSelectElementDialog(false);
            return;
        }

        if (appState.draggingElement) {
            setShowChangeElementDialog(false);
            setShowSelectElementDialog(false);
            return;
        }

        if (!showSelectElementDialog && !metaKeyIsDown) {
            setShowChangeElementDialog(true);
        }

        applyChangeElementPosition(selectedElement);
        applySelectElementPosition(selectedElement);
    };

    const handleChangeElementDialogClick = () => {
        if (!excalidrawApi) return;

        setShowSelectElementDialog(true);
        setShowChangeElementDialog(false);
    };

    const closeSelectElementDialog = () => {
        setShowSelectElementDialog(false);
        setShowChangeElementDialog(false);

        DrawingUtil.focusCanvas();
    };

    const render = () => {
        return (
            <>
                {showChangeElementDialog && (
                    <ChangeElementDialog
                        changeElementRef={changeElementRef}
                        onClick={handleChangeElementDialogClick}
                    />
                )}
                {showSelectElementDialog && (
                    <SelectElementDialog
                        customRef={selectElementRef}
                        excalidrawApi={excalidrawApi}
                        closeSelectElementDialog={closeSelectElementDialog}
                    />
                )}
            </>
        );
    };

    return {
        render,
        handleSelectedElementVisuals,
        handleChangeElementDialogClick,
    };
};
