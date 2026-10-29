import { useGlobal } from "@/contexts/global-context";
import { NativeBlockMenu } from "@/features/draw/models/native/native-block-menu";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { Minus, Plus } from "lucide-react";
import { ReactNode } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { cn } from "ui";
import { MAX_COLUMNS, MAX_ROWS, Table, TABLE_LOOKS } from "../models/table";
import type { TableContent } from "../models/table-render";
import { useTableStore } from "../stores/use-table-store";

const GROUP_CLASS =
    "flex h-full items-center gap-0.5 rounded-lg bg-[#ECECF4] p-1 dark:bg-[#23232A]";
const ICON_CLASS =
    "grid h-full w-7 place-items-center rounded-md hover:bg-black/5 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-white/10";

const Option = ({
    isActive,
    onClick,
    children,
}: {
    isActive: boolean;
    onClick: () => void;
    children: ReactNode;
}) => (
    <button
        type="button"
        onClick={onClick}
        aria-pressed={isActive}
        className={cn(
            "h-full whitespace-nowrap rounded-md px-2.5",
            isActive
                ? "bg-[#e0dfff] font-semibold text-[#4a47b1] dark:bg-[#403e6a] dark:text-[#e0dfff]"
                : "hover:bg-black/5 dark:hover:bg-white/10"
        )}
    >
        {children}
    </button>
);

type CounterProps = {
    label: string;
    count: number;
    max: number;
    onChange: (add: boolean) => void;
};

const Counter = ({ label, count, max, onChange }: CounterProps) => (
    <div className={GROUP_CLASS}>
        <span className="px-1.5">{label}</span>
        <button
            type="button"
            aria-label={`Remove the last ${label.toLowerCase().replace(/s$/, "")}`}
            disabled={count <= 1}
            onClick={() => onChange(false)}
            className={ICON_CLASS}
        >
            <Minus className="h-4 w-4" />
        </button>
        <span className="min-w-5 text-center font-semibold tabular-nums">{count}</span>
        <button
            type="button"
            aria-label={`Add a ${label.toLowerCase().replace(/s$/, "")}`}
            disabled={count >= max}
            onClick={() => onChange(true)}
            className={ICON_CLASS}
        >
            <Plus className="h-4 w-4" />
        </button>
    </div>
);

type Props = {
    id: string;
    look: TableContent["look"];
    headerRow: boolean;
    headerColumn: boolean;
    rows: number;
    columns: number;
};

/** A table's look, headers, and how many rows and columns it has, while it's selected */
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

    return (
        <div className="pointer-events-auto absolute z-[3] flex h-full items-center gap-2 text-sm">
            <div className={GROUP_CLASS}>
                {TABLE_LOOKS.map(option => (
                    <Option
                        key={option.look}
                        isActive={look === option.look}
                        onClick={() => void change(() => ({ look: option.look }))}
                    >
                        {option.label}
                    </Option>
                ))}
            </div>
            <div className={GROUP_CLASS}>
                <Option
                    isActive={headerRow}
                    onClick={() => void change(() => ({ headerRow: !headerRow }))}
                >
                    Header row
                </Option>
                <Option
                    isActive={headerColumn}
                    onClick={() => void change(() => ({ headerColumn: !headerColumn }))}
                >
                    Header column
                </Option>
            </div>
            <Counter
                label="Rows"
                count={rows}
                max={MAX_ROWS}
                onChange={add =>
                    void change(content => ({
                        rows: add ? Table.addRow(content.rows) : Table.removeRow(content.rows),
                    }))
                }
            />
            <Counter
                label="Columns"
                count={columns}
                max={MAX_COLUMNS}
                onChange={add =>
                    void change(content => ({
                        rows: add
                            ? Table.addColumn(content.rows)
                            : Table.removeColumn(content.rows),
                    }))
                }
            />
        </div>
    );
};

/** In Excalidraw's footer while a table is selected */
export const TableMenuContainer = () => {
    const selected = useTableStore(state => state.selected);
    const container = NativeBlockMenu.getContainer();
    if (!selected || !container) return null;
    return createPortal(<TableMenu {...selected} />, container);
};
