import { useGlobal } from "@/contexts/global-context";
import { OnChangeCallback } from "@/features/draw/draw";
import { DrawingUtil } from "@/features/draw/utils/drawing-util";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { ExcalidrawUtil } from "@/features/draw/utils/excalidraw-util";
import { ChangeElementDialog } from "@/features/selected-element-visuals/components/change-element-dialog";
import { ExtendElementsContainer } from "@/features/selected-element-visuals/components/extend-elements-container";
import { SelectElementDialog } from "@/features/selected-element-visuals/components/select-element-dialog";
import { useChangeElementDialog } from "@/features/selected-element-visuals/hooks/use-change-element-dialog";
import { useExtendElementsButtons } from "@/features/selected-element-visuals/hooks/use-extend-element-buttons";
import { useSelectElementDialog } from "@/features/selected-element-visuals/hooks/use-select-element-dialog";
import { useChangeElementStore } from "@/stores/use-change-element-store";
import { first } from "@banjoanton/utils";

export const useSelectedElementVisuals = () => {
    const { excalidrawApi } = useGlobal();
    const {
        changeElementRef,
        setShowChangeElementDialog,
        showChangeElementDialog,
        applyPosition: applyChangeElementPosition,
    } = useChangeElementDialog();

    const {
        selectElementRef,
        setShowSelectElementDialog,
        showSelectElementDialog,
        applyPosition: applySelectElementPosition,
    } = useSelectElementDialog();

    const {
        refs: extendElementRefs,
        setShowExtendElements,
        showExtendElements,
        applyPosition: applyExtendElementsPosition,
    } = useExtendElementsButtons();

    const hideAllElements = () => {
        setShowChangeElementDialog(false);
        setShowSelectElementDialog(false);
        setShowExtendElements(false);
    };

    const metaKeyIsDown = useChangeElementStore(s => s.metaKeyIsDown);

    const handleSelectedElementVisuals: OnChangeCallback = (elements, appState) => {
        if (!excalidrawApi) return;

        const selected = ElementUtil.getSelectedElements(appState, elements);

        if (selected.length !== 1) {
            hideAllElements();
            return;
        }

        const selectedElement = first(selected);

        if (!selectedElement) {
            hideAllElements();
            return;
        }

        if (ExcalidrawUtil.isLinearElement(selectedElement)) {
            hideAllElements();
            return;
        }

        if (appState.draggingElement) {
            hideAllElements();
            return;
        }

        if (!showSelectElementDialog && !metaKeyIsDown) {
            setShowChangeElementDialog(true);
        }

        applyChangeElementPosition(selectedElement);
        applySelectElementPosition(selectedElement);
        applyExtendElementsPosition(selectedElement);

        setShowExtendElements(true);
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
                        closeSelectElementDialog={closeSelectElementDialog}
                    />
                )}
                {showExtendElements && <ExtendElementsContainer refs={extendElementRefs} />}
            </>
        );
    };

    return {
        render,
        handleSelectedElementVisuals,
        handleChangeElementDialogClick,
    };
};
