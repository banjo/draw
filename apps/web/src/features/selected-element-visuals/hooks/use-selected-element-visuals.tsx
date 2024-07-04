import { useGlobal } from "@/contexts/global-context";
import { OnChangeCallback } from "@/features/draw/draw";
import { DrawingUtil } from "@/features/draw/utils/drawing-util";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { ExcalidrawUtil } from "@/features/draw/utils/excalidraw-util";
import { SmartCopyKeyDialog } from "@/features/selected-element-visuals/components/change-element-key-dialog";
import { ExtendElementsContainer } from "@/features/selected-element-visuals/components/extend-elements-container";
import { SelectElementDialog } from "@/features/selected-element-visuals/components/select-element-dialog";
import { useExtendElementsButtons } from "@/features/selected-element-visuals/hooks/use-extend-element-buttons";
import { useSelectElementDialog } from "@/features/selected-element-visuals/hooks/use-select-element-dialog";
import { useVisualElementStore } from "@/stores/use-visual-element-store";
import { first, noop } from "@banjoanton/utils";
import { ElementMeasurement } from "common";
import { useChangeElementKeyDialog } from "./use-change-element-dialog";
import { useSmartCopyKeyDialog } from "./use-smart-copy-key-dialog";
import { CustomDataUtil } from "@/features/draw/utils/custom-data-util";
import { ChangeElementKeyDialog } from "../components/smart-copy-key-dialog";

const MIN_ELEMENT_VISUAL_SIZE = 40;

export const useSelectedElementVisuals = () => {
    const { excalidrawApi } = useGlobal();
    const {
        changeElementKeyRef,
        showChangeElementKeyDialog,
        setShowChangeElementKeyDialog,
        applyPosition: applyChangeElementPosition,
    } = useChangeElementKeyDialog();

    const {
        smartCopyKeyDialogRef,
        showSmartCopyDialog,
        setShowSmartCopyDialog,
        applyPosition: applySmartCopyKeyPosition,
    } = useSmartCopyKeyDialog();

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
        setShowChangeElementKeyDialog(false);
        setShowSelectElementDialog(false);
        setShowExtendElements(false);
        setShowSmartCopyDialog(false);
    };

    const metaKeyIsDown = useVisualElementStore(s => s.metaKeyIsDown);

    const handleSelectedElementVisuals: OnChangeCallback = (elements, appState) => {
        if (!excalidrawApi) return;

        const isDraggingElement = Boolean(appState.draggingElement);

        if (isDraggingElement) {
            hideAllElements();
            return;
        }

        const selected = ElementUtil.getSelectedElements(appState, elements);

        if (CustomDataUtil.isModelElements(selected)) {
            hideAllElements();
            const container = selected.find(CustomDataUtil.isModelContainerElement);

            if (container) {
                setShowSmartCopyDialog(true);
                applySmartCopyKeyPosition(container);
            }

            return;
        }

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

        const elementMeasurements = ElementMeasurement.from({
            height: selectedElement.height,
            width: selectedElement.width,
        });

        const elementIsTooSmall = DrawingUtil.isElementTooSmall(
            elementMeasurements,
            appState.zoom.value,
            MIN_ELEMENT_VISUAL_SIZE
        );

        if (elementIsTooSmall) {
            hideAllElements();
            return;
        }

        if (appState.draggingElement) {
            hideAllElements();
            return;
        }

        if (!showSelectElementDialog && !metaKeyIsDown) {
            setShowChangeElementKeyDialog(true);
        }

        applyChangeElementPosition(selectedElement);
        applySelectElementPosition(selectedElement);
        applyExtendElementsPosition(selectedElement);

        setShowExtendElements(true);
    };

    const handleChangeElementDialogClick = () => {
        if (!excalidrawApi) return;

        setShowSelectElementDialog(true);
        setShowChangeElementKeyDialog(false);
    };

    const closeSelectElementDialog = () => {
        setShowSelectElementDialog(false);
        setShowChangeElementKeyDialog(false);

        DrawingUtil.focusCanvas();
    };

    const render = () => (
        <>
            {showChangeElementKeyDialog && (
                <ChangeElementKeyDialog
                    changeElementKeyRef={changeElementKeyRef}
                    onClick={handleChangeElementDialogClick}
                />
            )}
            {showSelectElementDialog && (
                <SelectElementDialog
                    customRef={selectElementRef}
                    closeSelectElementDialog={closeSelectElementDialog}
                />
            )}

            {showSmartCopyDialog && (
                <SmartCopyKeyDialog keyRef={smartCopyKeyDialogRef} onClick={noop} />
            )}

            {showExtendElements && <ExtendElementsContainer refs={extendElementRefs} />}
        </>
    );

    return {
        render,
        handleSelectedElementVisuals,
        handleChangeElementDialogClick,
    };
};
