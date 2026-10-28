import { produce } from "@banjoanton/utils";
import { AppState, ToolType } from "@excalidraw/excalidraw/types";
import { Mutable } from "@excalidraw/excalidraw/utility-types";

const clearBindings = (state: Mutable<AppState>) => {
    state.suggestedBindings = [];
};

const createActiveTool = (tool: ToolType): AppState["activeTool"] => ({
    type: tool,
    customType: null,
    locked: false,
    lastActiveTool: null,
});

const setActiveTool = (state: Mutable<AppState>, tool: ToolType) => {
    state.activeTool = createActiveTool(tool);
};

const helpers = { clearBindings, setActiveTool };

type UpdateHelpers = typeof helpers;
type UpdateCallback = (state: Mutable<AppState>, helpers: UpdateHelpers) => AppState;

const updateState = (state: AppState, callback: UpdateCallback): AppState =>
    produce(state, draft => callback(draft, helpers));

export const StateUtil = { updateState, createActiveTool };
