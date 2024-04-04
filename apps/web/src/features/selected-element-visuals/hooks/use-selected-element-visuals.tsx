import { OnChangeCallback } from "@/features/draw/draw";
import { DrawingUtil } from "@/features/draw/utils/drawing-util";
import { ElementPositionUtil } from "@/features/draw/utils/element-position-util";
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
    const { changeElementRef, setShowChangeElementDialog, showChangeElementDialog } =
        useChangeElementDialog();

    const { selectElementRef, setShowSelectElementDialog, showSelectElementDialog } =
        useSelectElementDialog();

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

        const { width, height } = ElementPositionUtil.getPositionFromElement(selectedElement);
        const { x, y } = ElementPositionUtil.getElementWindowPosition(selectedElement, appState);

        // make sure the element is centered as well and count for zoom
        const dialogWidth = changeElementRef.current?.offsetWidth ?? 0;
        const dialogX = x + (width * appState.zoom.value) / 2 - dialogWidth / 2;

        // place dialog above the element
        const dialogY = y - 80;

        changeElementRef.current?.setAttribute("style", `top: ${dialogY}px; left: ${dialogX}px`);

        // place select element dialog under the element
        const selectWidth = selectElementRef.current?.offsetWidth ?? 0;
        const selectX = x + (width * appState.zoom.value) / 2 - selectWidth / 2;
        const selectY = y + height + 20;
        selectElementRef.current?.setAttribute("style", `top: ${selectY}px; left: ${selectX}px`);
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
