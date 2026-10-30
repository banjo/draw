import { useGlobal } from "@/contexts/global-context";
import { BlockSettings, Setting, Stepper } from "@/features/draw/components/block-settings";
import { NativeBlockSettings } from "@/features/draw/models/native/native-block-settings";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { createPortal } from "react-dom";
import { MAX_LANES, MIN_LANES, SwimlaneLayout } from "../models/swimlane-layout";
import { useSwimlaneStore } from "../stores/use-swimlane-store";

/** How many lanes the selected swimlane has, in Excalidraw's sidebar */
const SwimlaneMenu = ({ id, lanes }: { id: string; lanes: number }) => {
    const { excalidrawApi } = useGlobal();

    const setLanes = (count: number) => {
        if (!excalidrawApi) return;
        const updated = SwimlaneLayout.setLaneCount(
            excalidrawApi.getSceneElementsIncludingDeleted(),
            id,
            count
        );
        if (!updated) return;
        excalidrawApi.updateScene({
            elements: updated,
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
    };

    return (
        <BlockSettings>
            <Setting label="Lanes">
                <Stepper
                    name="lane"
                    value={lanes}
                    min={MIN_LANES}
                    max={MAX_LANES}
                    onChange={setLanes}
                />
            </Setting>
            <p className="m-0 text-[0.75rem] leading-snug text-[var(--color-gray-60,#7a7a7a)]">
                Double-click a lane&apos;s name to rename it.
            </p>
        </BlockSettings>
    );
};

/** In Excalidraw's sidebar while a swimlane is selected */
export const SwimlaneMenuContainer = () => {
    const selected = useSwimlaneStore(state => state.selected);
    if (!selected) return null;
    return createPortal(<SwimlaneMenu {...selected} />, NativeBlockSettings.container);
};
