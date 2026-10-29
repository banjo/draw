import { useGlobal } from "@/contexts/global-context";
import { OnChangeCallback } from "@/features/draw/draw";
import { useGeneratedImages } from "@/features/draw/hooks/utils/use-generated-images";
import { CustomDataUtil } from "@/features/draw/utils/custom-data-util";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { viewportCoordsToSceneCoords } from "@excalidraw/excalidraw";
import { ExcalidrawElement } from "common";
import React, { useMemo } from "react";
import { ChartEditor } from "../components/chart-editor";
import { ChartMenuContainer } from "../components/chart-menu";
import { Chart } from "../models/chart";
import { useChartStore } from "../stores/use-chart-store";

const CHART_SELECTED_CLASS = "chart-selected";

const isLiveChart = (element: ExcalidrawElement) =>
    CustomDataUtil.isChart(element) && !element.isDeleted;

const EditorContainer = () => {
    const { excalidrawApi } = useGlobal();
    const editingId = useChartStore(state => state.editingId);
    const element = editingId
        ? excalidrawApi?.getSceneElements().find(e => e.id === editingId)
        : undefined;
    return element ? <ChartEditor key={element.id} element={element} /> : null;
};

/** Charts: their images, made in each browser, the data editor and the menu */
export const useCharts = () => {
    const { excalidrawApi } = useGlobal();
    const { renderMissing } = useGeneratedImages(async chart => {
        const { file } = await Chart.render(Chart.getContent(chart));
        return { file, areas: undefined };
    });

    const updateCharts: OnChangeCallback = (elements, appState) => {
        const charts = elements.filter(isLiveChart);
        renderMissing(charts);

        const store = useChartStore.getState();
        // Removed or made a table while its data was being edited
        if (store.editingId && !charts.some(chart => chart.id === store.editingId)) {
            store.setEditingId(undefined);
        }

        const selection = ElementUtil.getSelectedElements(appState, elements);
        const [chart] = selection;
        let next;
        if (selection.length === 1 && chart && isLiveChart(chart)) {
            const { rows: _, title: __, ...settings } = Chart.getContent(chart);
            next = { id: chart.id, ...settings };
        }
        if (JSON.stringify(next) !== JSON.stringify(store.selected)) store.setSelected(next);

        // Excalidraw's hint is about cropping, which a chart's image isn't for
        document.body.classList.toggle(CHART_SELECTED_CLASS, Boolean(next));
    };

    /** Double-clicking a chart edits its data, instead of cropping */
    const onDoubleClickCapture = (event: React.MouseEvent) => {
        if (!excalidrawApi || !(event.target instanceof HTMLCanvasElement)) return;
        const { x, y } = viewportCoordsToSceneCoords(event, excalidrawApi.getAppState());
        const chart = excalidrawApi
            .getSceneElements()
            .filter(isLiveChart)
            .findLast(e => x >= e.x && x <= e.x + e.width && y >= e.y && y <= e.y + e.height);
        if (!chart) return;
        event.preventDefault();
        event.stopPropagation();
        useChartStore.getState().setEditingId(chart.id);
    };

    const charts = useMemo(
        () =>
            excalidrawApi ? (
                <>
                    <EditorContainer />
                    <ChartMenuContainer />
                </>
            ) : null,
        [excalidrawApi]
    );

    return { charts, updateCharts, onDoubleClickCapture };
};
