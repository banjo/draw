import { DiagramReader as CommonDiagramReader, DiagramSelection, ExcalidrawElement } from "common";

export type Selection = DiagramSelection;

/**
 * What's selected, as a diagram the AI can change, with ids made from labels. Bound text goes
 * with its shape, a frame brings what's in it, and arrows between selected things come along.
 */
const read = (selected: readonly ExcalidrawElement[], scene: readonly ExcalidrawElement[]) =>
    CommonDiagramReader.read(selected, scene, { ids: "readable" });

export const DiagramReader = { read };
