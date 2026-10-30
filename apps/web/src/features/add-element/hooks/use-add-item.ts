import { useGlobal } from "@/contexts/global-context";
import { useChartStore } from "@/features/chart/stores/use-chart-store";
import { useLinkCardStore } from "@/features/link-card/stores/use-link-card-store";
import { useMarkdownNoteStore } from "@/features/markdown-note/stores/use-markdown-note-store";
import { useMermaidDialogStore } from "@/features/mermaid/stores/use-mermaid-dialog-store";
import { useCodeEditorStore } from "@/features/selected-element-visuals/stores/use-code-editor-store";
import { useTableStore } from "@/features/table/stores/use-table-store";
import toast from "react-hot-toast";
import { ElementItem, getItemKey, getItemTitle, Item } from "../models/add-element-item";
import { useRecentElementsStore } from "../stores/use-recent-elements-store";
import { placeWithPointer } from "../models/place-with-pointer";
import { ClientPoint, Placement, useInsertElement } from "./use-insert-element";

type Inserted = NonNullable<Awaited<ReturnType<ReturnType<typeof useInsertElement>["insert"]>>>;

const isMermaid = (item: Item) => item.kind === "element" && item.shape.type === "mermaid";
const isLinkCard = (item: Item) => item.kind === "element" && item.shape.type === "link";

/** Written in their own dialog first, so they're added one at a time */
export const hasDialog = (item: Item) => isMermaid(item) || isLinkCard(item) || item.kind === "ai";

/** Opens the dialog a Mermaid diagram or a link card is written in, to add it at the placement */
export const openAddDialog = (item: Item, placement: Placement) => {
    if (isMermaid(item)) useMermaidDialogStore.getState().open({ kind: "insert", placement });
    else useLinkCardStore.getState().open({ kind: "insert", placement });
};

/** What was just added is for writing in: code, a note's text, a table's cells, a chart's data */
export const startEditing = (added: Inserted) => {
    if (added.codeBlock) useCodeEditorStore.getState().setEditingElementId(added.codeBlock.id);
    if (added.markdownNote) useMarkdownNoteStore.getState().setEditingId(added.markdownNote.id);
    if (added.table) {
        useTableStore.getState().setEditing({ id: added.table.id, row: 0, column: 0 });
    }
    if (added.chart) useChartStore.getState().setEditingId(added.chart.id);
};

/**
 * Adds a shape or block and edits it. Given where the pointer is, it follows the pointer until
 * a click puts it down; else it's added in the middle of the screen, like the palette does.
 */
export const useAddItem = () => {
    const { excalidrawApi } = useGlobal();
    const { getStartPlacement, insert } = useInsertElement();

    return async (item: ElementItem, pointer?: ClientPoint) => {
        const placement = getStartPlacement(pointer);
        if (!excalidrawApi || !placement) return;
        useRecentElementsStore.getState().addRecent(getItemKey(item));

        if (hasDialog(item)) {
            openAddDialog(item, getStartPlacement() ?? placement);
            return;
        }
        try {
            const added = await insert(item, placement, { isPending: Boolean(pointer) });
            if (!added) return;
            if (pointer && !(await placeWithPointer(excalidrawApi, added.ids, pointer))) return;
            startEditing(added);
        } catch {
            toast.error(`Couldn't add ${getItemTitle(item)}`);
        }
    };
};
