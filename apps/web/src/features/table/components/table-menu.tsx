import { useGlobal } from "@/contexts/global-context";
import { Chart } from "@/features/chart/models/chart";
import {
    ActionButton,
    BlockSettings,
    Choices,
    Setting,
    Stepper,
    Toggle,
} from "@/features/draw/components/block-settings";
import { NativeBlockSettings } from "@/features/draw/models/native/native-block-settings";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { BarChart3, Pencil } from "lucide-react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { MAX_COLUMNS, MAX_ROWS, Table, TABLE_LOOKS } from "../models/table";
import type { TableContent } from "../models/table-render";
import { useTableStore } from "../stores/use-table-store";

type Props = {
    id: string;
    look: TableContent["look"];
    headerRow: boolean;
    headerColumn: boolean;
    rows: number;
    columns: number;
};

/** A table's look, headers, and how many rows and columns it has, in Excalidraw's sidebar */
const TableMenu = ({ id, look, headerRow, headerColumn, rows, columns }: Props) => {
    const { excalidrawApi } = useGlobal();

    const change = async (getChanges: (content: TableContent) => Partial<TableContent>) => {
        if (!excalidrawApi) return;
        const current = excalidrawApi.getSceneElements().find(e => e.id === id);
        if (!current) return;
        try {
            const updated = await Table.update(current, getChanges(Table.getContent(current)));
            excalidrawApi.addFiles([updated.file]);
            excalidrawApi.updateScene({
                elements: ElementUtil.mergeElements(
                    excalidrawApi.getSceneElementsIncludingDeleted(),
                    [updated.element]
                ),
                captureUpdate: CaptureUpdateAction.IMMEDIATELY,
            });
        } catch {
            toast.error("Couldn't draw the table");
        }
    };

    /** Adds or removes rows or columns at the end, one at a time */
    const resize = (kind: "rows" | "columns", count: number) =>
        void change(content => {
            const isRows = kind === "rows";
            const current = isRows ? rows : columns;
            if (count > current) {
                return {
                    rows: isRows ? Table.addRow(content.rows) : Table.addColumn(content.rows),
                };
            }
            return {
                rows: isRows ? Table.removeRow(content.rows) : Table.removeColumn(content.rows),
            };
        });

    return (
        <BlockSettings>
            <Setting label="Look">
                <Choices
                    options={TABLE_LOOKS.map(option => ({
                        value: option.look,
                        label: option.label,
                    }))}
                    value={look}
                    onChange={value => void change(() => ({ look: value }))}
                />
            </Setting>
            <Setting label="Headers">
                <Toggle
                    label="Header row"
                    checked={headerRow}
                    onChange={checked => void change(() => ({ headerRow: checked }))}
                />
                <Toggle
                    label="Header column"
                    checked={headerColumn}
                    onChange={checked => void change(() => ({ headerColumn: checked }))}
                />
            </Setting>
            <div className="grid grid-cols-2 gap-2">
                <Setting label="Rows">
                    <Stepper
                        name="row"
                        value={rows}
                        min={1}
                        max={MAX_ROWS}
                        onChange={count => resize("rows", count)}
                    />
                </Setting>
                <Setting label="Columns">
                    <Stepper
                        name="column"
                        value={columns}
                        min={1}
                        max={MAX_COLUMNS}
                        onChange={count => resize("columns", count)}
                    />
                </Setting>
            </div>
            <div className="flex flex-col gap-1.5">
                <ActionButton
                    isPrimary
                    shortcut="↵"
                    icon={<Pencil className="h-3.5 w-3.5" />}
                    onClick={() => useTableStore.getState().setEditing({ id, row: 0, column: 0 })}
                >
                    Edit cells
                </ActionButton>
                <ActionButton
                    icon={<BarChart3 className="h-4 w-4" />}
                    onClick={() => excalidrawApi && void Chart.switchView(excalidrawApi, id)}
                >
                    Show as chart
                </ActionButton>
            </div>
        </BlockSettings>
    );
};

/** In Excalidraw's sidebar while a table is selected */
export const TableMenuContainer = () => {
    const selected = useTableStore(state => state.selected);
    if (!selected) return null;
    return createPortal(<TableMenu {...selected} />, NativeBlockSettings.container);
};
