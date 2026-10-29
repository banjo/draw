import { useGlobal } from "@/contexts/global-context";
import { OnChangeCallback } from "@/features/draw/draw";
import { DrawingUtil } from "@/features/draw/utils/drawing-util";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { ExcalidrawUtil } from "@/features/draw/utils/excalidraw-util";
import { SmartCopyKeyDialog } from "@/features/selected-element-visuals/components/smart-copy-key-dialog";
import { ExtendElementsContainer } from "@/features/selected-element-visuals/components/extend-elements-container";
import { SelectElementDialog } from "@/features/selected-element-visuals/components/select-element-dialog";
import { useExtendElementsButtons } from "@/features/selected-element-visuals/hooks/use-extend-element-buttons";
import { useSelectElementDialog } from "@/features/selected-element-visuals/hooks/use-select-element-dialog";
import { useVisualElementStore } from "@/stores/use-visual-element-store";
import { first, noop } from "@banjoanton/utils";
import { ElementMeasurement, ExcalidrawElement } from "common";
import { useChangeElementKeyDialog } from "./use-change-element-dialog";
import { useSmartCopyKeyDialog } from "./use-smart-copy-key-dialog";
import { CustomDataUtil } from "@/features/draw/utils/custom-data-util";
import { ChangeElementKeyDialog } from "../components/change-element-key-dialog";
import { useEffect } from "react";

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

    /** The "Tab · Change shape" hint, not on blocks like a table or a note, which keep their type */
    const updateChangeHint = (element: ExcalidrawElement) => {
        if (!CustomDataUtil.canChangeType(element)) {
            setShowChangeElementKeyDialog(false);
        } else if (!showSelectElementDialog && !metaKeyIsDown) {
            setShowChangeElementKeyDialog(true);
        }
    };

    const handleSelectedElementVisuals: OnChangeCallback = (elements, appState) => {
        if (!excalidrawApi) return;

        // Drawing a new element or a selection box
        const isDraggingElement = Boolean(appState.newElement ?? appState.selectionElement);

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

        const multipleElementsSelected = selected.length > 1;
        const isElementGroup = ElementUtil.isElementGroup(selected);

        if (multipleElementsSelected && !isElementGroup) {
            hideAllElements();
            return;
        }

        const selectedElement = ElementUtil.getParentElementOfGroup(selected) ?? first(selected);

        if (!selectedElement || !CustomDataUtil.hasShapeActions(selectedElement)) {
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

        if (appState.newElement ?? appState.selectionElement) {
            hideAllElements();
            return;
        }

        updateChangeHint(selectedElement);

        applyChangeElementPosition(selectedElement);
        applySelectElementPosition(selectedElement);
        applyExtendElementsPosition(selectedElement);

        setShowExtendElements(true);
    };

    // Run again when these change, as they aren't in Excalidraw's state, so they don't trigger
    // its onChange. A dialog that just appeared also needs its position, which is set
    // through its ref and so couldn't be set before it rendered.
    useEffect(() => {
        if (!excalidrawApi) return;
        handleSelectedElementVisuals(
            excalidrawApi.getSceneElements(),
            excalidrawApi.getAppState(),
            {}
        );
    }, [
        metaKeyIsDown,
        showSelectElementDialog,
        showChangeElementKeyDialog,
        showExtendElements,
        showSmartCopyDialog,
    ]);

    const handleChangeElementDialogClick = () => {
        if (!excalidrawApi) return;

        setShowSelectElementDialog(true);
        setShowChangeElementKeyDialog(false);
    };

    const closeSelectElementDialog = ({ focusCanvas = true } = {}) => {
        setShowSelectElementDialog(false);
        setShowChangeElementKeyDialog(false);

        if (focusCanvas) DrawingUtil.focusCanvas();
    };

    const render = () => (
        <>
            {showChangeElementKeyDialog ? (
                <ChangeElementKeyDialog
                    changeElementKeyRef={changeElementKeyRef}
                    onClick={handleChangeElementDialogClick}
                />
            ) : null}
            {showSelectElementDialog ? (
                <SelectElementDialog
                    customRef={selectElementRef}
                    closeSelectElementDialog={closeSelectElementDialog}
                />
            ) : null}

            {showSmartCopyDialog ? (
                <SmartCopyKeyDialog keyRef={smartCopyKeyDialogRef} onClick={noop} />
            ) : null}

            {showExtendElements ? <ExtendElementsContainer refs={extendElementRefs} /> : null}
        </>
    );

    return {
        render,
        handleSelectedElementVisuals,
        handleChangeElementDialogClick,
    };
};
