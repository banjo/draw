import {
    AppState,
    Collaborator,
    ExcalidrawImperativeAPI,
    SceneData,
} from "@excalidraw/excalidraw/types";
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
        captureUpdate?: SceneData["captureUpdate"];
    }) => void;
    getSceneElementsIncludingDeleted: () => ExcalidrawElements;
};
