import { produce } from "@banjoanton/utils";
import { AppState, ToolType } from "@excalidraw/excalidraw/types/types";
import { Mutable } from "@excalidraw/excalidraw/types/utility-types";
import { ExcalidrawElement } from "common";

const clearBindings = (state: Mutable<AppState>) => {
    state.suggestedBindings = [];
};

const setActiveTool = (state: Mutable<AppState>, tool: ToolType) => {
    state.activeTool = {
        type: tool,
        customType: null,
        locked: false,
        lastActiveTool: null,
    };
};

const arrowActiveToolDefaultSettings = (state: Mutable<AppState>) => {
    state.currentChartType = "bar";
    state.currentItemBackgroundColor = "transparent";
    state.currentItemEndArrowhead = "arrow";
    state.currentItemFillStyle = "solid";
    state.currentItemFontFamily = 1;
    state.currentItemFontSize = 20;
    state.currentItemOpacity = 100;
    state.currentItemRoughness = 1;
    state.currentItemStartArrowhead = null;
    state.currentItemStrokeColor = "#1e1e1e";
    state.currentItemRoundness = "round";
    state.currentItemStrokeStyle = "solid";
    state.currentItemStrokeWidth = 2;
    state.currentItemTextAlign = "left";
};

const dragElement = (state: Mutable<AppState>, element: ExcalidrawElement) => {
    // @ts-ignore
    state.draggingElement = element;
    // @ts-ignore
    state.editingElement = element;
};

const helpers = { clearBindings, setActiveTool, arrowActiveToolDefaultSettings, dragElement };

type UpdateHelpers = typeof helpers;
export type UpdateCallback = (state: Mutable<AppState>, helpers?: UpdateHelpers) => AppState;
export type MutateCallback = (state: Mutable<AppState>, helpers: UpdateHelpers) => void;

const updateState = (state: AppState, callback: UpdateCallback): AppState => {
    return produce(state, draft => callback(draft, helpers));
};

const mutateState = (state: AppState, callback: MutateCallback): void => {
    callback(state, helpers);
};

export const StateUtil = { updateState, mutateState };
