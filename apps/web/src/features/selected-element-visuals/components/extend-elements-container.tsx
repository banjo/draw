import { useGlobal } from "@/contexts/global-context";
import { ArrowKey } from "@/features/draw/hooks/base/use-keyboard";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { KeyboardUtil, MetaArrowResult } from "@/features/draw/utils/keyboard-util";
import { ExtendElementButton } from "@/features/selected-element-visuals/components/extend-element-button";
import { ExtendElementRefSummary } from "@/features/selected-element-visuals/hooks/use-extend-element-buttons";
import { Maybe } from "@banjoanton/utils";
import {
    ArrowDownCircle,
    ArrowLeftCircle,
    ArrowRightCircle,
    ArrowUpCircle,
    LucideIcon,
} from "lucide-react";
import { useState } from "react";

type Props = {
    refs: ExtendElementRefSummary[];
};

const iconMap: Record<ArrowKey, LucideIcon> = {
    ArrowUp: ArrowUpCircle,
    ArrowRight: ArrowRightCircle,
    ArrowDown: ArrowDownCircle,
    ArrowLeft: ArrowLeftCircle,
};

export const ExtendElementsContainer = ({ refs }: Props) => {
    const { excalidrawApi } = useGlobal();
    const [activeElements, setActiveElements] = useState<Maybe<MetaArrowResult>>(undefined);

    const onMouseLeave = () => {
        if (!excalidrawApi) return;

        let elements = excalidrawApi.getSceneElements();
        if (activeElements) {
            elements = ElementUtil.removeActiveElements(elements, activeElements);
        }

        excalidrawApi.updateScene({
            elements,
        });
        setActiveElements(undefined);
    };

    const getOnMouseEnter = (position: ArrowKey) => () => {
        if (!excalidrawApi) return;
        const newActiveElements = KeyboardUtil.handleMetaArrowDown(
            position,
            excalidrawApi,
            activeElements,
            false
        );
        if (newActiveElements) {
            setActiveElements(newActiveElements);
        }
    };

    const getOnClick = (position: ArrowKey) => () => {
        if (!excalidrawApi) return;

        const newActiveElements = KeyboardUtil.handleMetaArrowDown(
            position,
            excalidrawApi,
            activeElements,
            false
        );

        if (!newActiveElements) return;
        KeyboardUtil.handleMetaArrowUp(newActiveElements, excalidrawApi);
    };

    return (
        <>
            {refs.map(({ position, ref }) => (
                <ExtendElementButton
                    customRef={ref}
                    Icon={iconMap[position]}
                    onMouseLeave={onMouseLeave}
                    onMouseEnter={getOnMouseEnter(position)}
                    onClick={getOnClick(position)}
                />
            ))}
        </>
    );
};
