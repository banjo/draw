import { useGlobal } from "@/contexts/global-context";
import { OnChangeCallback } from "@/features/draw/draw";
import { useGeneratedImages } from "@/features/draw/hooks/utils/use-generated-images";
import { CustomDataUtil } from "@/features/draw/utils/custom-data-util";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { viewportCoordsToSceneCoords } from "@excalidraw/excalidraw";
import { AppState } from "@excalidraw/excalidraw/types";
import { ExcalidrawElement, ExcalidrawElements } from "common";
import { useLatestCallback } from "@/hooks/use-latest-callback";
import React, { useEffect, useMemo } from "react";
import { TableCellEditor } from "../components/table-cell-editor";
import { TableMenuContainer } from "../components/table-menu";
import { Table } from "../models/table";
import type { CellBox } from "../models/table-render";
import { TableView, useTableStore } from "../stores/use-table-store";

const TABLE_SELECTED_CLASS = "table-selected";

const isLiveTable = (element: ExcalidrawElement) =>
    CustomDataUtil.isTable(element) && !element.isDeleted;

const EditorContainer = () => {
    const { excalidrawApi } = useGlobal();
    const editing = useTableStore(state => state.editing);
    // Re-rendered with the table, which the editor reads
    useTableStore(state => state.view);
    const element = editing
        ? excalidrawApi?.getSceneElements().find(e => e.id === editing.id)
        : undefined;
    if (!editing || !element) return null;
    return (
        <TableCellEditor
            key={element.id}
            element={element}
            cell={{ row: editing.row, column: editing.column }}
        />
    );
};

/** The table selected on its own, if any */
const getSelectedTable = (elements: ExcalidrawElements, appState: AppState) => {
    const selection = ElementUtil.getSelectedElements(appState, elements);
    const [table] = selection;
    if (selection.length !== 1 || !table || !isLiveTable(table)) return undefined;
    const { rows, ...content } = Table.getContent(table);
    return { id: table.id, ...content, rows: rows.length, columns: rows[0]?.length ?? 1 };
};

const isSameView = (a: TableView | undefined, b: TableView | undefined) =>
    a?.scrollX === b?.scrollX &&
    a?.scrollY === b?.scrollY &&
    a?.zoom === b?.zoom &&
    a?.theme === b?.theme &&
    a?.version === b?.version;

/** Tables: their images, made in each browser, the cell editor and the menu */
export const useTables = () => {
    const { excalidrawApi } = useGlobal();
    const { renderMissing, getAreas } = useGeneratedImages<{ cells: CellBox[]; width: number }>(
        async table => {
            const { file, cells, width } = await Table.render(Table.getContent(table));
            return { file, areas: { cells, width } };
        }
    );

    const updateTables: OnChangeCallback = (elements, appState) => {
        const tables = elements.filter(isLiveTable);
        renderMissing(tables);
        const store = useTableStore.getState();

        const editingTable = store.editing && tables.find(table => table.id === store.editing?.id);
        // Removed while it was being typed in, e.g. by someone else
        if (store.editing && !editingTable) store.setEditing(undefined);
        const view = editingTable && {
            scrollX: appState.scrollX,
            scrollY: appState.scrollY,
            zoom: appState.zoom.value,
            theme: appState.theme,
            version: editingTable.version,
        };
        if (!isSameView(view, store.view)) store.setView(view);

        const next = getSelectedTable(elements, appState);
        if (JSON.stringify(next) !== JSON.stringify(store.selected)) store.setSelected(next);

        // Excalidraw's hint is about cropping, which a table's image isn't for
        document.body.classList.toggle(TABLE_SELECTED_CLASS, Boolean(next));
    };

    const latestUpdate = useLatestCallback(updateTables);

    // Show the editor as soon as it's opened, not on the next change
    useEffect(() => {
        if (!excalidrawApi) return;
        return useTableStore.subscribe((state, previous) => {
            if (state.editing?.id === previous.editing?.id) return;
            latestUpdate(
                excalidrawApi.getSceneElements(),
                excalidrawApi.getAppState(),
                excalidrawApi.getFiles()
            );
        });
    }, [excalidrawApi, latestUpdate]);

    /** Double-clicking a table types in the cell under the pointer, instead of cropping */
    const onDoubleClickCapture = (event: React.MouseEvent) => {
        if (!excalidrawApi || !(event.target instanceof HTMLCanvasElement)) return;
        const { x, y } = viewportCoordsToSceneCoords(event, excalidrawApi.getAppState());
        const table = excalidrawApi
            .getSceneElements()
            .filter(isLiveTable)
            .findLast(e => x >= e.x && x <= e.x + e.width && y >= e.y && y <= e.y + e.height);
        if (!table) return;
        event.preventDefault();
        event.stopPropagation();

        const areas = getAreas(table);
        const scale = areas ? areas.width / table.width : 1;
        const cell = areas?.cells.find(
            box =>
                (x - table.x) * scale >= box.x &&
                (x - table.x) * scale <= box.x + box.width &&
                (y - table.y) * scale >= box.y &&
                (y - table.y) * scale <= box.y + box.height
        );
        useTableStore
            .getState()
            .setEditing({ id: table.id, row: cell?.row ?? 0, column: cell?.column ?? 0 });
    };

    const tables = useMemo(
        () =>
            excalidrawApi ? (
                <>
                    <EditorContainer />
                    <TableMenuContainer />
                </>
            ) : null,
        [excalidrawApi]
    );

    return { tables, updateTables, onDoubleClickCapture };
};
