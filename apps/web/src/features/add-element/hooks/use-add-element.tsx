import { useGlobal } from "@/contexts/global-context";
import { AddElementContainer } from "../containers/add-element-container";

export const useAddElement = () => {
    const { excalidrawApi } = useGlobal();

    const render = () => {
        if (!excalidrawApi) return null;

        return <AddElementContainer />;
    };

    return {
        render,
    };
};
