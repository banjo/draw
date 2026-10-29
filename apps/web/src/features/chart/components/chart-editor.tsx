import { Hint } from "@/components/keys";
import { useGlobal } from "@/contexts/global-context";
import { NativeContainer } from "@/features/draw/models/native/native-container";
import { BlockEditUtil } from "@/features/draw/utils/block-edit-util";
import { useLatestCallback } from "@/hooks/use-latest-callback";
import { ExcalidrawElement } from "common";
import { Plus, X } from "lucide-react";
import {
    ClipboardEvent,
    FocusEvent,
    KeyboardEvent,
    MouseEvent,
    useEffect,
    useRef,
    useState,
} from "react";
import { cn } from "ui";
import { Chart, MAX_CHART_COLUMNS, MAX_CHART_ROWS } from "../models/chart";
import { isNumeric } from "../models/chart-data";
import { PALETTES } from "../models/chart-render";
import { useChartStore } from "../stores/use-chart-store";

// The chart shows what's typed this long after typing stops
const COMMIT_DELAY = 150;

type Data = { rows: string[][]; title: string };

const CELL_CLASS =
    "h-8 w-full min-w-0 bg-transparent px-2 text-[13px] outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-[#6965db] dark:focus:bg-[#121212] dark:focus:ring-[#a8a5ff]";
const ICON_CLASS =
    "grid h-6 w-6 shrink-0 place-items-center rounded-md text-zinc-400 opacity-0 hover:bg-black/5 hover:text-[#1b1b1f] group-hover:opacity-100 group-focus-within:opacity-100 dark:hover:bg-white/10 dark:hover:text-white";

// Keeps focus in the field being typed in, so clicking a button doesn't close the panel
const keepFocus = (event: MouseEvent) => event.preventDefault();

const getCellLabel = (row: number, column: number) => {
    if (row === 0) return `Name of series ${column}`;
    if (column === 0) return `Label ${row}`;
    return `Row ${row}, series ${column}`;
};

/** The cell's input, by row and column */
const cellId = (row: number, column: number) => `chart-cell-${row}-${column}`;

const focusCell = (row: number, column: number) =>
    requestAnimationFrame(() => {
        const input = document.getElementById(cellId(row, column)) as HTMLInputElement | null;
        input?.focus();
        input?.select();
    });

/**
 * Changes a chart's title and numbers, in a panel at the side, with the chart changing as you
 * type. The first row has the series' names, the first column the labels.
 */
export const ChartEditor = ({ element }: { element: ExcalidrawElement }) => {
    const { excalidrawApi } = useGlobal();
    const [data, setData] = useState<Data>(() => {
        const { rows, title } = Chart.getContent(element);
        return { rows, title };
    });
    const panel = useRef<HTMLDivElement>(null);

    const pending = useRef<Data>();
    const timer = useRef<ReturnType<typeof setTimeout>>();
    // The chart as it was when the editor opened, for undo
    const original = useRef(element);
    const changed = useRef(false);
    const lastCommit = useRef(Promise.resolve());

    const getCurrent = () =>
        excalidrawApi
            ?.getSceneElementsIncludingDeleted()
            .find(e => e.id === element.id && !e.isDeleted);

    /** One at a time and in order, as drawing a chart takes a moment */
    const commit = useLatestCallback(() => {
        clearTimeout(timer.current);
        const value = pending.current;
        pending.current = undefined;
        if (!value) return lastCommit.current;

        lastCommit.current = lastCommit.current.then(async () => {
            const current = getCurrent();
            if (!excalidrawApi || !current) return;
            const before = Chart.getContent(current);
            if (
                JSON.stringify([before.rows, before.title]) ===
                JSON.stringify([value.rows, value.title])
            ) {
                return;
            }
            const { element: updated, file } = await Chart.update(current, value);
            excalidrawApi.addFiles([file]);
            // Sent to collaborators, but kept out of undo until the editor closes
            BlockEditUtil.applyUnrecorded(excalidrawApi, updated);
            changed.current = true;
        });
        return lastCommit.current;
    });

    const finish = useLatestCallback(async () => {
        await commit().catch(() => undefined);
        if (!excalidrawApi || !changed.current) return;
        changed.current = false;
        BlockEditUtil.recordUndoStep(excalidrawApi, original.current);
    });

    const close = () => {
        void finish();
        useChartStore.getState().setEditingId(undefined);
        NativeContainer.parse();
        NativeContainer.focus();
    };

    useEffect(() => {
        focusCell(1, 1);
        // Closed some other way, e.g. the chart was removed
        return () => void finish();
    }, [finish]);

    const change = (next: Data) => {
        setData(next);
        pending.current = next;
        clearTimeout(timer.current);
        timer.current = setTimeout(() => void commit(), COMMIT_DELAY);
    };

    const setRows = (rows: string[][]) => change({ ...data, rows: Chart.normalize(rows) });

    const setCell = (row: number, column: number, text: string) =>
        setRows(
            data.rows.map((cells, r) =>
                r === row ? cells.map((cell, c) => (c === column ? text : cell)) : cells
            )
        );

    const columns = data.rows[0]?.length ?? 1;

    const addRow = () => {
        if (data.rows.length >= MAX_CHART_ROWS) return;
        setRows([...data.rows, Array.from({ length: columns }, () => "")]);
        focusCell(data.rows.length, 0);
    };

    const addSeries = () => {
        if (columns >= MAX_CHART_COLUMNS) return;
        setRows(data.rows.map((cells, r) => [...cells, r === 0 ? `Series ${columns}` : ""]));
        focusCell(0, columns);
    };

    const removeRow = (row: number) => setRows(data.rows.filter((_, r) => r !== row));
    const removeSeries = (column: number) =>
        setRows(data.rows.map(cells => cells.filter((_, c) => c !== column)));

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>, row: number, column: number) => {
        if (event.key === "Escape") {
            event.stopPropagation();
            close();
        } else if (event.key === "Enter") {
            event.preventDefault();
            if (row + 1 < data.rows.length) focusCell(row + 1, column);
            else if (data.rows.length < MAX_CHART_ROWS) {
                setRows([...data.rows, Array.from({ length: columns }, () => "")]);
                focusCell(row + 1, column);
            }
        }
    };

    /** Rows copied from a spreadsheet fill the cells from this one */
    const onPaste = (event: ClipboardEvent<HTMLInputElement>, row: number, column: number) => {
        const text = event.clipboardData.getData("text/plain");
        if (!text.includes("\t") && !text.includes("\n")) return;
        event.preventDefault();
        const pasted = text
            .replace(/\r\n?/g, "\n")
            .replace(/\n+$/, "")
            .split("\n")
            .map(line => line.split("\t"));
        const height = Math.min(MAX_CHART_ROWS, Math.max(data.rows.length, row + pasted.length));
        const width = Math.min(
            MAX_CHART_COLUMNS,
            Math.max(columns, column + Math.max(...pasted.map(l => l.length)))
        );
        const rows = Array.from({ length: height }, (_, r) =>
            Array.from(
                { length: width },
                (__, c) => pasted[r - row]?.[c - column] ?? data.rows[r]?.[c] ?? ""
            )
        );
        setRows(rows);
    };

    // Closes when something outside it gets focus, like the canvas
    const onBlur = (event: FocusEvent) => {
        if (!panel.current?.contains(event.relatedTarget as Node | null)) close();
    };

    const { palette, look } = Chart.getContent(element);
    const colors = look === "clean" ? PALETTES[palette].clean : PALETTES[palette].sketchy;

    const cell = (
        row: number,
        column: number,
        props: { placeholder?: string; className?: string } = {}
    ) => (
        <input
            id={cellId(row, column)}
            value={data.rows[row]?.[column] ?? ""}
            onChange={event => setCell(row, column, event.target.value)}
            onKeyDown={event => onKeyDown(event, row, column)}
            onPaste={event => onPaste(event, row, column)}
            spellCheck={false}
            autoComplete="off"
            aria-label={getCellLabel(row, column)}
            placeholder={props.placeholder}
            className={cn(CELL_CLASS, props.className)}
        />
    );

    return (
        <div
            ref={panel}
            role="dialog"
            aria-label="Chart data"
            onBlur={onBlur}
            className="fixed right-4 top-[72px] z-[4] flex max-h-[min(560px,calc(100dvh-160px))] w-[min(440px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl bg-white text-[#1b1b1f] shadow-[0_30px_70px_-24px_rgba(25,25,60,0.45),0_0_0_1px_rgba(20,20,40,0.07)] duration-200 animate-in fade-in-0 slide-in-from-right-2 dark:bg-[#1d1d23] dark:text-[#ececf1] dark:shadow-[0_30px_70px_-24px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.07)] dark:[color-scheme:dark]"
        >
            <header className="flex h-12 shrink-0 items-center border-b border-black/[0.07] px-4 dark:border-white/[0.07]">
                <h2 className="text-[15px] font-semibold">Chart data</h2>
                <button
                    type="button"
                    onMouseDown={keepFocus}
                    onClick={close}
                    aria-label="Close"
                    className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-zinc-400 hover:bg-black/5 hover:text-[#1b1b1f] dark:hover:bg-white/10 dark:hover:text-white"
                >
                    <X className="h-4 w-4" />
                </button>
            </header>

            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4">
                <input
                    value={data.title}
                    onChange={event => change({ ...data, title: event.target.value })}
                    onKeyDown={event =>
                        event.key === "Escape" && (event.stopPropagation(), close())
                    }
                    placeholder="Title"
                    aria-label="Title"
                    className="h-9 rounded-lg bg-[#f6f8fa] px-3 text-[14px] font-medium outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-[#6965db] dark:bg-[#18181d] dark:ring-white/10 dark:focus:ring-[#a8a5ff]"
                />
                <div className="overflow-auto rounded-lg ring-1 ring-black/10 dark:ring-white/10">
                    <table className="w-full table-fixed border-collapse text-[13px]">
                        <thead>
                            <tr className="bg-[#f6f8fa] dark:bg-[#18181d]">
                                <th className="w-[30%] border-b border-black/10 dark:border-white/10">
                                    {cell(0, 0, {
                                        placeholder: "Label",
                                        className: "font-semibold text-zinc-500",
                                    })}
                                </th>
                                {data.rows[0]?.slice(1).map((_, i) => (
                                    <th
                                        key={i}
                                        className="group border-b border-l border-black/10 dark:border-white/10"
                                    >
                                        <div className="flex items-center pl-2 pr-1">
                                            <span
                                                className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                                                style={{ background: colors[i % colors.length] }}
                                            />
                                            {cell(0, i + 1, { className: "font-semibold" })}
                                            {columns > 2 ? (
                                                <button
                                                    type="button"
                                                    onMouseDown={keepFocus}
                                                    onClick={() => removeSeries(i + 1)}
                                                    aria-label={`Remove ${data.rows[0]?.[i + 1] || "series"}`}
                                                    className={ICON_CLASS}
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            ) : null}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.rows.slice(1).map((cells, r) => (
                                <tr
                                    key={r}
                                    className="group border-b border-black/[0.06] last:border-b-0 dark:border-white/[0.06]"
                                >
                                    <td>
                                        <div className="flex items-center pr-1">
                                            {cell(r + 1, 0)}
                                            {data.rows.length > 2 ? (
                                                <button
                                                    type="button"
                                                    onMouseDown={keepFocus}
                                                    onClick={() => removeRow(r + 1)}
                                                    aria-label={`Remove ${cells[0] || "row"}`}
                                                    className={ICON_CLASS}
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            ) : null}
                                        </div>
                                    </td>
                                    {cells.slice(1).map((value, c) => (
                                        <td
                                            key={c}
                                            className="border-l border-black/[0.06] dark:border-white/[0.06]"
                                        >
                                            {cell(r + 1, c + 1, {
                                                className: cn(
                                                    "text-right tabular-nums",
                                                    value.trim() &&
                                                        !isNumeric(value) &&
                                                        "text-[#e03131]"
                                                ),
                                            })}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="flex items-center gap-2 text-[12.5px]">
                    {[
                        {
                            label: "Row",
                            handleClick: addRow,
                            disabled: data.rows.length >= MAX_CHART_ROWS,
                        },
                        {
                            label: "Series",
                            handleClick: addSeries,
                            disabled: columns >= MAX_CHART_COLUMNS,
                        },
                    ].map(button => (
                        <button
                            key={button.label}
                            type="button"
                            onMouseDown={keepFocus}
                            onClick={button.handleClick}
                            disabled={button.disabled}
                            className="flex h-7 items-center gap-1 rounded-lg px-2.5 font-medium text-zinc-500 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] hover:text-[#1b1b1f] disabled:opacity-40 dark:text-zinc-400 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] dark:hover:text-white"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            {button.label}
                        </button>
                    ))}
                    <span className="ml-auto text-zinc-400">Paste rows from a spreadsheet</span>
                </div>
            </div>

            <footer className="flex shrink-0 items-center gap-3 border-t border-black/[0.07] bg-black/[0.02] px-4 py-2.5 text-[12px] text-zinc-500 dark:border-white/[0.07] dark:bg-white/[0.02] dark:text-zinc-400">
                <Hint keys={["Tab"]}>Next cell</Hint>
                <Hint keys={["↵"]}>Cell below</Hint>
                <span className="ml-auto">
                    <Hint keys={["esc"]}>Close</Hint>
                </span>
            </footer>
        </div>
    );
};
