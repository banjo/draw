import { useGlobal } from "@/contexts/global-context";
import { isDefined, isEmpty, Maybe, partition } from "@banjoanton/utils";
import { ClipboardData } from "@excalidraw/excalidraw/types/clipboard";
import { CustomDataUtil } from "../../utils/custom-data-util";
import { CustomData, ExcalidrawElement } from "common";
import { ElementUtil } from "../../utils/element-util";
import { UpdateElementUtil } from "../../utils/update-element-util";

export const useOnPaste = () => {
    const { excalidrawApi } = useGlobal();
    const handleOnPaste = (
        data: ClipboardData,
        event: ClipboardEvent | null
    ): Promise<boolean> | boolean => {
        if (!excalidrawApi) return true;
        const copiedElements = data.elements as Maybe<ExcalidrawElement[]>;
        if (!isDefined(copiedElements) || isEmpty(copiedElements)) return true;

        const allElements = excalidrawApi.getSceneElements();
        const appState = excalidrawApi.getAppState();

        // Update custom data group id to avoid conflicts on copy
        const [containerModels, otherElements] = partition(
            copiedElements,
            CustomDataUtil.isModelContainerElement
        );

        console.log({ event });

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
