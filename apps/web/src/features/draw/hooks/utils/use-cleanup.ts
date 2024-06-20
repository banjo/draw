import { isEmpty } from "@banjoanton/utils";
import { CustomDataUtil } from "../../utils/custom-data-util";
import { CustomData } from "common";
import { SPACING, TEXT_HEIGHT } from "../../utils/element-creation-util";
import { OnChangeCallback } from "../../draw";
import { UpdateElementUtil } from "../../utils/update-element-util";

const cleanupModel: OnChangeCallback = (elements, appState, files) => {
    // TODO: add sync script so that groupId is added to customData if it does not exists?

    const modelElements = elements.filter(CustomDataUtil.isAnyModelElement);
    if (isEmpty(modelElements)) return;

    const containers = modelElements.filter(CustomDataUtil.isModelContainerElement);
    if (isEmpty(containers)) return;

    containers.forEach(container => {
        const data = CustomData.parseModelData(container.customData);
        if (!data) return;

        const customDataElementAmount = data.textElementCount;
        const modelTextElements = modelElements.filter(
            e => e.groupIds.includes(data.groupId) && CustomDataUtil.isModelTextElement(e)
        );

        if (modelTextElements.length === customDataElementAmount) return;

        const elementsToAdd = modelTextElements.length - customDataElementAmount;
        const newHeight = container.height + (SPACING + TEXT_HEIGHT) * elementsToAdd;

        const newData = CustomData.updateModel(data, {
            textElementCount: modelTextElements.length,
            currentHeight: newHeight,
        });

        UpdateElementUtil.mutateElement(container, draft => {
            draft.customData = newData;
            draft.height = newHeight;
        });
    });
};

// const cleanupShadows: OnChangeCallback = (elements, appState, files) => {
//     const shadowElements = elements.filter(CustomDataUtil.isShadowElement);
//     if (isEmpty(shadowElements)) return;
//
//     UpdateElementUtil.mutateElements(shadowElements, draft => {
//         draft.isDeleted = true;
//     });
// };

export const useCleanup = () => {
    const cleanup: OnChangeCallback = (...props) => {
        // Make model work with undo/redo
        cleanupModel(...props);
        // cleanupShadows(...props); // TODO: Cleanup shadows messes with collab mode, do we need it?
    };

    return { cleanup };
};
