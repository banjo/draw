import { OnChangeCallback } from "@/features/draw/draw";
import { DrawingUtil } from "@/features/draw/utils/drawing-util";
import { ElementType } from "@/features/draw/utils/element-creation-util";
import { ElementPositionUtil } from "@/features/draw/utils/element-position-util";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { KeyboardUtil } from "@/features/draw/utils/keyboard-util";
import { cn } from "@/lib/utils";
import { useChangeElementStore } from "@/stores/use-change-element-store";
import { Callback, Maybe, first } from "@banjoanton/utils";
import { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import { Circle, Diamond, LucideIcon, RectangleHorizontalIcon } from "lucide-react";
import { KeyboardEventHandler, useEffect, useRef, useState } from "react";

type In = {
    excalidrawApi: Maybe<ExcalidrawImperativeAPI>;
};

const ShapeIcon = ({
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

type Props = In & {
    closeSelectElementDialog: Callback;
};

const ShapeIconContainer = ({ excalidrawApi, closeSelectElementDialog }: Props) => {
    const shapes: { type: ElementType; icon: LucideIcon }[] = [
        { type: "rectangle", icon: RectangleHorizontalIcon },
        { type: "ellipse", icon: Circle },
        { type: "diamond", icon: Diamond },
    ];

    const [selectedIndex, setSelectedIndex] = useState(() => {
        if (!excalidrawApi) return 0;
        const state = excalidrawApi.getAppState();
        const elements = excalidrawApi.getSceneElements();
        const selectedElements = ElementUtil.getSelectedElements(state, elements);

        if (selectedElements.length !== 1) return 0;

        const selected = first(selectedElements);
        if (!selected) return 0;

        const index = shapes.findIndex(({ type }) => type === selected.type);
        if (index === -1) return 0;

        return index;
    });

    const handleSelectElement = (type: ElementType) => {
        if (!excalidrawApi) return;
        KeyboardUtil.handleSelectSingleElement(excalidrawApi, type);
    };

    const handleKeyDown: KeyboardEventHandler<HTMLDivElement> = event => {
        if (!excalidrawApi) return;

        if (event.key === "Escape") {
            setSelectedIndex(0);
            closeSelectElementDialog();
            return;
        }

        if (event.key === "Enter") {
            const selectedElement = shapes[selectedIndex];
            if (!selectedElement) return;
            handleSelectElement(selectedElement.type);
            closeSelectElementDialog();
            return;
        }

        if (event.key === "ArrowRight" || event.key === "Tab") {
            setSelectedIndex((selectedIndex + 1) % shapes.length);
        } else if (event.key === "ArrowLeft") {
            setSelectedIndex((selectedIndex - 1 + shapes.length) % shapes.length);
        }
    };

    return (
        <div className="flex flow-row gap-2" onKeyDown={handleKeyDown}>
            {shapes.map(({ type, icon }, index) => (
                <ShapeIcon
                    key={type}
                    Icon={icon}
                    type={type}
                    isSelected={selectedIndex === index}
                    handleClick={handleSelectElement}
                />
            ))}
        </div>
    );
};

export const useChangeElementDialog = ({ excalidrawApi }: In) => {
    const changeElementRef = useRef<HTMLButtonElement>(null);
    const setShowChangeElementDialog = useChangeElementStore(
        state => state.setShowChangeElementDialog
    );
    const showChangeElementDialog = useChangeElementStore(state => state.showChangeElementDialog);

    const selectElementRef = useRef<HTMLDivElement>(null);
    const [showSelectElementDialog, setShowSelectElementDialog] = useState(false);

    const metaKeyIsDown = useChangeElementStore(state => state.metaKeyIsDown);

    const handleChangeElementDialog: OnChangeCallback = (elements, appState) => {
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
        const dialogY = y - 50;

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

    // Focus on the dialog when it is shown
    useEffect(() => {
        if (showSelectElementDialog) {
            selectElementRef.current?.setAttribute("tabIndex", "-1");
            selectElementRef.current?.focus();
        }
    }, [showSelectElementDialog]);

    const closeSelectElementDialog = () => {
        setShowSelectElementDialog(false);
        setShowChangeElementDialog(false);

        DrawingUtil.focusCanvas();
    };

    const renderChangeElementDialog = () => {
        return (
            <>
                {showChangeElementDialog && (
                    <button
                        type="button"
                        className="absolute z-[3] flex gap-2 justify-center
                    items-center p-1 bg-[#ECECF4] rounded-md
                    font-thin text-xs text-[#1B1B1F]
                    hover:cursor-pointer"
                        ref={changeElementRef}
                        onClick={handleChangeElementDialogClick}
                    >
                        <p>Tab</p>
                    </button>
                )}
                {showSelectElementDialog && (
                    <div
                        ref={selectElementRef}
                        className="absolute z-[3] flex p-2 
                        bg-white border shadow-lg
                        rounded-md font-thin text-xs text-[#1B1B1F] hover:cursor-pointer"
                    >
                        <ShapeIconContainer
                            closeSelectElementDialog={closeSelectElementDialog}
                            excalidrawApi={excalidrawApi}
                        />
                    </div>
                )}
            </>
        );
    };

    return {
        renderChangeElementDialog,
        handleChangeElementDialog,
        handleChangeElementDialogClick,
    };
};
