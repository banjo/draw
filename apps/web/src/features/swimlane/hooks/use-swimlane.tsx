import { useGlobal } from "@/contexts/global-context";
import { OnChangeCallback } from "@/features/draw/draw";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { useMemo } from "react";
import { SwimlaneMenuContainer } from "../components/swimlane-menu";
import { SwimlaneLayout } from "../models/swimlane-layout";
import { useSwimlaneStore } from "../stores/use-swimlane-store";

/** Keeps swimlanes' lanes in place, and shows the menu of a selected one */
export const useSwimlane = () => {
    const { excalidrawApi } = useGlobal();

    const updateSwimlanes: OnChangeCallback = (elements, appState) => {
        if (!excalidrawApi) return;

        // Left out of undo: undoing a change to the swimlane puts its lanes back by this too
        const updated = SwimlaneLayout.sync(
            excalidrawApi.getSceneElementsIncludingDeleted(),
            appState.editingTextElement?.id
        );
        if (updated) {
            excalidrawApi.updateScene({
                elements: updated,
                captureUpdate: CaptureUpdateAction.NEVER,
            });
        }

        const selected = ElementUtil.getSelectedElements(appState, elements);
        const [swimlane] = selected;
        const isOnlySwimlane =
            selected.length === 1 && swimlane && SwimlaneLayout.isSwimlane(swimlane);
        const next = isOnlySwimlane
            ? { id: swimlane.id, lanes: SwimlaneLayout.getLaneCount(swimlane) }
            : undefined;

        const { selected: current, setSelected } = useSwimlaneStore.getState();
        if (current?.id !== next?.id || current?.lanes !== next?.lanes) setSelected(next);
    };

    const swimlaneMenu = useMemo(
        () => (excalidrawApi ? <SwimlaneMenuContainer /> : null),
        [excalidrawApi]
    );

    return { updateSwimlanes, swimlaneMenu };
};
