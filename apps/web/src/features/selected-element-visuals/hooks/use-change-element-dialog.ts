import { useChangeElementTimer } from "@/features/selected-element-visuals/hooks/use-change-element-timer";
import { useChangeElementStore } from "@/stores/use-change-element-store";
import { useRef } from "react";

type In = {};

export const useChangeElementDialog = () => {
    const changeElementRef = useRef<HTMLDivElement>(null);
    const setShowChangeElementDialog = useChangeElementStore(s => s.setShowChangeElementDialog);
    const showChangeElementDialogByGlobalState = useChangeElementStore(
        s => s.showChangeElementDialog
    );

    const { showChangeElementByTime } = useChangeElementTimer();

    const showChangeElementDialog = showChangeElementDialogByGlobalState && showChangeElementByTime;

    return {
        changeElementRef,
        showChangeElementDialog,
        setShowChangeElementDialog,
    };
};
