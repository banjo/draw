import { useGlobal } from "@/contexts/global-context";
import { useAddElementStore } from "@/stores/use-add-element-store";
import { useEffect } from "react";
import { AddElementContainer } from "../containers/add-element-container";
import { AddElementService } from "../services/add-element-service";

export const useAddElement = () => {
    const { excalidrawApi } = useGlobal();
    const showAddElement = useAddElementStore(s => s.showAddElementMenu);
    const setShowAddElement = useAddElementStore(s => s.setShowAddElementMenu);

    useEffect(() => {
        if (!excalidrawApi) return;

        // Read when clicked, as this handler is set up once per drawing
        const onClick = () => {
            setShowAddElement(!useAddElementStore.getState().showAddElementMenu);
        };

        AddElementService.init({ onClick });
    }, [excalidrawApi]);

    const render = () => {
        if (!excalidrawApi) return null;
        if (!showAddElement) return null;

        return <AddElementContainer />;
    };

    return {
        render,
    };
};
