import { useGlobal } from "@/contexts/global-context";
import { ArrowKey } from "@/features/draw/hooks/base/use-keyboard";
import { ElementUtil } from "@/features/draw/utils/element-util";
import {
    ElementExtensionShadow,
    ElementVisualUtils,
} from "@/features/draw/utils/element-visual-utils";
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
    const [shadowElements, setShadowElements] = useState<Maybe<ElementExtensionShadow>>(undefined);

    const onMouseLeave = () => {
        if (!excalidrawApi) return;

        let elements = excalidrawApi.getSceneElements();
        if (shadowElements) {
            elements = ElementUtil.removeActiveElements(elements, shadowElements);
        }

        excalidrawApi.updateScene({
            elements,
        });
        setShadowElements(undefined);
    };

    const getOnMouseEnter = (position: ArrowKey) => () => {
        if (!excalidrawApi) return;
        const newActiveElements = ElementVisualUtils.createElementExtensionShadow(
            position,
            excalidrawApi,
            shadowElements,
            false
        );
        if (newActiveElements) {
            setShadowElements(newActiveElements);
        }
    };

    const getOnClick = (position: ArrowKey) => () => {
        if (!excalidrawApi) return;

        const newActiveElements = ElementVisualUtils.createElementExtensionShadow(
            position,
            excalidrawApi,
            shadowElements,
            false
        );

        if (!newActiveElements) return;
        ElementVisualUtils.createElementExtensionFromShadow(newActiveElements, excalidrawApi);
    };

    return (
        <>
            {refs.map(({ position, ref }) => (
                <ExtendElementButton
                    key={position}
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
