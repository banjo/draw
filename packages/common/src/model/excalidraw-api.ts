import {
    AppState,
    Collaborator,
    ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types/types";
import { ExcalidrawElements } from "./excalidraw-element";

// remove readonly from ExcalidrawImperativeAPI
export type ExcalidrawApi = Omit<
    ExcalidrawImperativeAPI,
    "getSceneElements" | "updateScene" | "getSceneElementsIncludingDeleted"
> & {
    getSceneElements: () => ExcalidrawElements;
    updateScene: (sceneData: {
        elements?: ExcalidrawElements | null | undefined;
        appState?: AppState | null | undefined;
        collaborators?: Map<string, Collaborator>;
        commitToHistory?: boolean;
    }) => void;
    getSceneElementsIncludingDeleted: () => ExcalidrawElements;
};
