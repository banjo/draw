import { useGlobal } from "@/contexts/global-context";
import { NativeBlockMenu } from "@/features/draw/models/native/native-block-menu";
import { Minus, Plus } from "lucide-react";
import { createPortal } from "react-dom";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { MAX_LANES, MIN_LANES, SwimlaneLayout } from "../models/swimlane-layout";
import { useSwimlaneStore } from "../stores/use-swimlane-store";

const BUTTON_CLASS =
    "grid h-full w-8 place-items-center rounded-lg hover:bg-black/5 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-white/10";

/** How many lanes the selected swimlane has, with buttons to add and remove one */
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
        <div className="pointer-events-auto absolute z-[3] flex h-full items-center">
            <div className="flex h-full items-center gap-1 rounded-lg bg-[#ECECF4] px-1 text-sm dark:bg-[#23232A]">
                <span className="px-2">Lanes</span>
                <button
                    type="button"
                    aria-label="Remove a lane"
                    title="Remove the last lane"
                    disabled={lanes <= MIN_LANES}
                    onClick={() => setLanes(lanes - 1)}
                    className={BUTTON_CLASS}
                >
                    <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-5 text-center font-semibold tabular-nums">{lanes}</span>
                <button
                    type="button"
                    aria-label="Add a lane"
                    title="Add a lane at the bottom"
                    disabled={lanes >= MAX_LANES}
                    onClick={() => setLanes(lanes + 1)}
                    className={BUTTON_CLASS}
                >
                    <Plus className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
};

/** In Excalidraw's footer while a swimlane is selected */
export const SwimlaneMenuContainer = () => {
    const selected = useSwimlaneStore(state => state.selected);
    const container = NativeBlockMenu.getContainer();
    if (!selected || !container) return null;
    return createPortal(<SwimlaneMenu {...selected} />, container);
};
