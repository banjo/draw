import { useGlobal } from "@/contexts/global-context";
import { isDefined, isEmpty, Maybe, partition } from "@banjoanton/utils";
import { ClipboardData } from "@excalidraw/excalidraw/clipboard";
import { CustomDataUtil } from "../../utils/custom-data-util";
import { CustomData, ExcalidrawElement } from "common";
import { ElementUtil } from "../../utils/element-util";
import { FrameUtil } from "../../utils/frame-util";
import { placeElements } from "@/features/add-element/hooks/use-insert-element";
import { Table } from "@/features/table/models/table";
import { CaptureUpdateAction, getVisibleSceneBounds } from "@excalidraw/excalidraw";
import { UpdateElementUtil } from "../../utils/update-element-util";

export const useOnPaste = () => {
    const { excalidrawApi } = useGlobal();
    /** Rows from a spreadsheet as a table, in the middle of the screen */
    const pasteTable = async (rows: string[][]) => {
        if (!excalidrawApi) return;
        const { element, file } = await Table.create({ rows });
        const [minX, minY, maxX, maxY] = getVisibleSceneBounds(excalidrawApi.getAppState());
        const elements = FrameUtil.addToFrame(
            placeElements([element], { center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 } }),
            excalidrawApi.getSceneElements()
        );
        excalidrawApi.addFiles([file]);
        excalidrawApi.updateScene({
            elements: [...excalidrawApi.getSceneElementsIncludingDeleted(), ...elements],
            appState: ElementUtil.createNewElementSelection(elements, excalidrawApi.getAppState())
                .updatedState,
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
    };

    const handleOnPaste = (
        data: ClipboardData,
        event: ClipboardEvent | null
    ): Promise<boolean> | boolean => {
        if (!excalidrawApi) return true;
        const copiedElements = data.elements as Maybe<ExcalidrawElement[]>;

        // Rows copied from Excel, Sheets or Numbers, instead of Excalidraw's chart
        const rows =
            isEmpty(copiedElements ?? []) &&
            Table.parsePasted(event?.clipboardData?.getData("text/plain") ?? data.text ?? "");
        if (rows) {
            void pasteTable(rows);
            return false;
        }

        if (!isDefined(copiedElements) || isEmpty(copiedElements)) return true;

        const allElements = excalidrawApi.getSceneElements();
        const appState = excalidrawApi.getAppState();

        const [containerModels, otherElements] = partition(
            copiedElements,
            CustomDataUtil.isModelContainerElement
        );

        // Update custom data group id to avoid conflicts on copy
        if (!isEmpty(containerModels)) {
            const offset = 20;
            for (const container of containerModels) {
                const newGroupId = ElementUtil.createElementId();
                const currentData = CustomData.parseModelData(container.customData);
                if (!currentData) continue;

                const previousGroupId = currentData.groupId;
                const elementsInGroup = otherElements.filter(e =>
                    e.groupIds.includes(previousGroupId)
                );

                const updatedData = CustomData.updateModel(currentData, {
                    groupId: newGroupId,
                });

                UpdateElementUtil.mutateElement(container, draft => {
                    draft.customData = updatedData;
                    draft.id = ElementUtil.createElementId();
                    draft.groupIds = draft.groupIds.map(id =>
                        id === previousGroupId ? newGroupId : id
                    );
                    draft.x += offset;
                    draft.y += offset;
                });

                for (const element of elementsInGroup) {
                    UpdateElementUtil.mutateElement(element, draft => {
                        draft.groupIds = draft.groupIds.map(id =>
                            id === previousGroupId ? newGroupId : id
                        );
                        draft.x += offset;
                        draft.y += offset;
                        draft.id = ElementUtil.createElementId();
                    });
                }
            }

            const { updatedState } = ElementUtil.createNewElementSelection(
                copiedElements,
                appState
            );

            excalidrawApi.updateScene({
                elements: [...allElements, ...copiedElements],
                appState: updatedState,
            });

            return false;
        }

        return true;
    };

    return { handleOnPaste };
};
