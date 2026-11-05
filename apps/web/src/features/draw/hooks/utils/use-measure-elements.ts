import { useGlobal } from "@/contexts/global-context";
import { DiagramBuilder } from "@/features/ai/models/diagram-builder";
import { Chart } from "@/features/chart/models/chart";
import { LinkCard } from "@/features/link-card/models/link-card";
import { MarkdownNote } from "@/features/markdown-note/models/markdown-note";
import { canEditDrawing } from "@/features/share/stores/use-drawing-access-store";
import { Table } from "@/features/table/models/table";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import {
    ElementFactory,
    ExcalidrawElement,
    ExcalidrawElements,
    ExcalidrawTextElement,
} from "common";
import { useRef } from "react";

type Size = { width: number; height: number };

const isUnmeasured = (element: ExcalidrawElement) =>
    !element.isDeleted && element.customData?.unmeasured === true;

/** The customData without the mark */
const measured = (element: ExcalidrawElement) => {
    const { unmeasured: _, ...customData } = element.customData ?? {
        shadow: false,
        type: "text" as const,
    };
    return customData as ExcalidrawElement["customData"];
};

/** A block's size, drawn as this browser draws it */
const getBlockSize = async (element: ExcalidrawElement): Promise<Size | undefined> => {
    switch (element.customData?.type) {
        case "markdown":
            return MarkdownNote.render(MarkdownNote.getContent(element));
        case "table":
            return Table.render(Table.getContent(element));
        case "chart":
            return Chart.render(Chart.getContent(element));
        case "link":
            return LinkCard.render(LinkCard.getContent(element));
        default:
            return undefined;
    }
};

/** Text measured again: a label stays in the middle of its container */
const measureText = (
    text: ExcalidrawTextElement,
    byId: Map<string, ExcalidrawElement>
): ExcalidrawElement => {
    const container = text.containerId ? byId.get(text.containerId) : undefined;
    if (container) {
        return ElementFactory.fitLabel(text, container, DiagramBuilder.metrics);
    }
    const size = DiagramBuilder.metrics.measure(text.originalText, text.fontSize);
    return { ...text, text: text.originalText, ...size } as ExcalidrawElement;
};

const loadFont = (text: ExcalidrawTextElement) =>
    document.fonts.load(`${text.fontSize}px Excalifont`).catch(() => undefined);

/**
 * Text and blocks made where they couldn't be measured, like by the API, are marked
 * `unmeasured`. The first browser that can edit the drawing measures them and shares the
 * right sizes, like any other change.
 */
export const useMeasureElements = () => {
    const { excalidrawApi } = useGlobal();
    const measuring = useRef(new Set<string>());

    const apply = (
        id: string,
        change: (
            current: ExcalidrawElement,
            byId: Map<string, ExcalidrawElement>
        ) => ExcalidrawElement
    ) => {
        if (!excalidrawApi) return;
        const scene = excalidrawApi.getSceneElementsIncludingDeleted();
        const byId = new Map(scene.map(element => [element.id, element]));
        const current = byId.get(id);
        // Measured by someone else meanwhile, or deleted
        if (!current || !isUnmeasured(current)) return;
        const changed = ElementFactory.bump(change(current, byId), {
            customData: measured(current),
        });
        excalidrawApi.updateScene({
            elements: scene.map(element =>
                element.id === id ? changed : element
            ) as ExcalidrawElements,
            captureUpdate: CaptureUpdateAction.NEVER,
        });
    };

    const measureElements = (elements: readonly ExcalidrawElement[]) => {
        if (!excalidrawApi || !canEditDrawing()) return;
        const unmeasured = elements.filter(
            element => isUnmeasured(element) && !measuring.current.has(element.id)
        );
        if (unmeasured.length === 0) return;

        for (const element of unmeasured) {
            measuring.current.add(element.id);
            const measure =
                element.type === "text"
                    ? loadFont(element as ExcalidrawTextElement).then(() =>
                          apply(element.id, (current, byId) =>
                              measureText(current as ExcalidrawTextElement, byId)
                          )
                      )
                    : getBlockSize(element).then(size => {
                          // Keeps its top left corner
                          apply(element.id, current => ({
                              ...current,
                              ...(size && { width: size.width, height: size.height }),
                          }));
                      });
            void measure.catch(() => undefined).finally(() => measuring.current.delete(element.id));
        }
    };

    return { measureElements };
};
