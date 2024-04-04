import { ElementType } from "@/features/draw/utils/element-creation-util";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { KeyboardUtil } from "@/features/draw/utils/keyboard-util";
import { SelectElementShapeIcon } from "@/features/selected-element-visuals/components/select-element-shape-icon";
import { Callback, Maybe, first } from "@banjoanton/utils";
import { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import { Circle, Diamond, LucideIcon, RectangleHorizontalIcon } from "lucide-react";
import { KeyboardEventHandler, useState } from "react";

type Props = {
    closeSelectElementDialog: Callback;
    excalidrawApi: Maybe<ExcalidrawImperativeAPI>;
};

export const SelectElementShapeContainer = ({ excalidrawApi, closeSelectElementDialog }: Props) => {
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
                <SelectElementShapeIcon
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
