import { useGlobal } from "@/contexts/global-context";
import { NativeContainer } from "@/features/draw/models/native/native-container";
import { BlockEditUtil } from "@/features/draw/utils/block-edit-util";
import { useLatestCallback } from "@/hooks/use-latest-callback";
import { ExcalidrawElement } from "common";
import { flushSync } from "react-dom";
import { KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { MAX_ROWS, Table } from "../models/table";
import { CellBox, TABLE_THEMES } from "../models/table-render";
import { TableCell, useTableStore } from "../stores/use-table-store";

// The table shows what's typed this long after typing stops
const COMMIT_DELAY = 120;

type Layout = { cells: CellBox[]; width: number };

type Props = { element: ExcalidrawElement; cell: TableCell };

/**
 * Types in a table's cell, over the cell. Tab and Shift+Tab go to the next and previous cell,
 * Enter to the one below; past the end they add a row. Escape or clicking away closes it.
 */
export const TableCellEditor = ({ element, cell }: Props) => {
    const { excalidrawApi } = useGlobal();
    // As it was when the editor opened; it's read from the drawing after that
    const opened = useRef(element).current;
    const view = useTableStore(state => state.view);
    const textarea = useRef<HTMLTextAreaElement>(null);
    const [layout, setLayout] = useState<Layout>();
    const [value, setValue] = useState(
        () => Table.getContent(opened).rows[cell.row]?.[cell.column] ?? ""
    );

    const pending = useRef<{ cell: TableCell; text: string }>();
    const timer = useRef<ReturnType<typeof setTimeout>>();
    // The table as it was when the editor opened, for undo
    const original = useRef(opened);
    const changed = useRef(false);
    const queue = useRef(Promise.resolve());

    const getCurrent = () =>
        excalidrawApi
            ?.getSceneElementsIncludingDeleted()
            .find(e => e.id === opened.id && !e.isDeleted);

    /** Changes the table, one change at a time and in order, as drawing it takes a moment */
    const change = (getRows: (rows: string[][]) => string[][]) => {
        queue.current = queue.current.then(async () => {
            const current = getCurrent();
            if (!excalidrawApi || !current) return;
            const { rows } = Table.getContent(current);
            const next = getRows(rows);
            if (JSON.stringify(next) === JSON.stringify(rows)) return;

            const updated = await Table.update(current, { rows: next });
            excalidrawApi.addFiles([updated.file]);
            // Sent to collaborators, but kept out of undo until the editor closes
            BlockEditUtil.applyUnrecorded(excalidrawApi, updated.element);
            // Now, before the move to a new row's cell renders, as the editor needs the cell
            flushSync(() => setLayout({ cells: updated.cells, width: updated.width }));
            changed.current = true;
        });
        return queue.current;
    };

    const commit = useLatestCallback(() => {
        clearTimeout(timer.current);
        const typed = pending.current;
        pending.current = undefined;
        if (!typed) return queue.current;
        return change(rows => Table.setCell(rows, typed.cell, typed.text));
    });

    const finish = useLatestCallback(async () => {
        await commit().catch(() => undefined);
        if (!excalidrawApi || !changed.current) return;
        changed.current = false;
        BlockEditUtil.recordUndoStep(excalidrawApi, original.current);
    });

    const close = () => {
        void finish();
        useTableStore.getState().setEditing(undefined);
        NativeContainer.parse();
        NativeContainer.focus();
    };

    // Where the cells are, before anything's typed
    useEffect(() => {
        void Table.render(Table.getContent(opened)).then(rendered =>
            setLayout(current => current ?? { cells: rendered.cells, width: rendered.width })
        );
        // Closed some other way, e.g. the table was removed
        return () => void finish();
    }, [opened, finish]);

    const hasLayout = layout !== undefined;

    // A new cell: its text, all selected, before anything else is typed. Once the editor is
    // shown, as it waits for the layout.
    useLayoutEffect(() => {
        const current = getCurrent();
        const text = current ? (Table.getContent(current).rows[cell.row]?.[cell.column] ?? "") : "";
        setValue(text);
        const field = textarea.current;
        if (!field) return;
        field.value = text;
        field.focus({ preventScroll: true });
        field.select();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cell.row, cell.column, hasLayout]);

    const onChange = (text: string) => {
        setValue(text);
        pending.current = { cell, text };
        clearTimeout(timer.current);
        timer.current = setTimeout(() => void commit(), COMMIT_DELAY);
    };

    /** To another cell, adding a row when it's past the last one */
    const moveTo = async (row: number, column: number) => {
        const current = getCurrent();
        if (!current || row < 0) return;
        const { rows } = Table.getContent(current);
        const columns = rows[0]?.length ?? 1;
        // What was typed is saved meanwhile, in the cell it was typed in
        void commit();
        if (row >= rows.length) {
            if (rows.length >= MAX_ROWS) return;
            await change(Table.addRow);
        }
        useTableStore
            .getState()
            .setEditing({ id: opened.id, row, column: Math.min(column, columns - 1) });
    };

    const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        const current = getCurrent();
        const columns = current ? (Table.getContent(current).rows[0]?.length ?? 1) : 1;
        const index = cell.row * columns + cell.column;

        if (event.key === "Escape") {
            event.stopPropagation();
            close();
        } else if (event.key === "Tab") {
            event.preventDefault();
            const next = index + (event.shiftKey ? -1 : 1);
            if (next >= 0) void moveTo(Math.floor(next / columns), next % columns);
        } else if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void moveTo(cell.row + 1, cell.column);
        }
    };

    const current = getCurrent() ?? opened;
    const box = layout?.cells.find(c => c.row === cell.row && c.column === cell.column);
    if (!view || !layout || !box) return null;

    const { look } = Table.getContent(current);
    const theme = TABLE_THEMES[look];
    const scale = (current.width / layout.width) * view.zoom;
    const isDark = view.theme === "dark";

    return (
        <textarea
            ref={textarea}
            value={value}
            onChange={event => onChange(event.target.value)}
            onKeyDown={onKeyDown}
            onBlur={close}
            spellCheck={false}
            aria-label={`Row ${cell.row + 1}, column ${cell.column + 1}`}
            className="absolute z-[3] resize-none overflow-hidden rounded-sm outline-none"
            style={{
                left: (current.x + view.scrollX) * view.zoom + box.x * scale,
                top: (current.y + view.scrollY) * view.zoom + box.y * scale,
                width: box.width * scale,
                height: box.height * scale,
                padding: `${theme.paddingY * scale}px ${theme.paddingX * scale}px`,
                fontFamily: theme.family,
                fontSize: theme.size * scale,
                lineHeight: theme.lineHeight,
                color: isDark ? "#e3e3e8" : theme.text,
                background: isDark ? "#121212" : "#ffffff",
                boxShadow: "0 0 0 2px var(--color-primary, #6965db)",
            }}
        />
    );
};
