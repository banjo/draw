import { ActionButton, BlockSettings, Setting } from "@/features/draw/components/block-settings";
import { NativeBlockSettings } from "@/features/draw/models/native/native-block-settings";
import { Pencil } from "lucide-react";
import { createPortal } from "react-dom";
import { useMermaidDialogStore } from "../stores/use-mermaid-dialog-store";

// The first word of a definition, and what kind of diagram it is
const DIAGRAM_NAMES: Record<string, string> = {
    flowchart: "Flowchart",
    graph: "Flowchart",
    sequencediagram: "Sequence diagram",
    classdiagram: "Class diagram",
    "classdiagram-v2": "Class diagram",
    statediagram: "State diagram",
    "statediagram-v2": "State diagram",
    erdiagram: "Entity relationship",
    journey: "User journey",
    gantt: "Gantt chart",
    pie: "Pie chart",
    mindmap: "Mind map",
    timeline: "Timeline",
    gitgraph: "Git graph",
    quadrantchart: "Quadrant chart",
    requirementdiagram: "Requirements",
    c4context: "C4 diagram",
    sankey: "Sankey",
    "sankey-beta": "Sankey",
    "xychart-beta": "XY chart",
    "block-beta": "Block diagram",
    kanban: "Kanban",
    "architecture-beta": "Architecture",
};

/** What kind of diagram it is, from the definition's first word after any front matter */
const getDiagramName = (definition: string) => {
    const lines = definition
        .replace(/^---[\s\S]*?---/, "")
        .split("\n")
        .map(line => line.trim())
        .filter(line => line && !line.startsWith("%%"));
    const word = lines[0]?.split(/\s+/)[0]?.toLowerCase() ?? "";
    return DIAGRAM_NAMES[word] ?? "Diagram";
};

/** What kind of diagram a Mermaid block is, and changing it, in Excalidraw's sidebar */
const MermaidMenu = ({ id, definition }: { id: string; definition: string }) => (
    <BlockSettings>
        <Setting label="Diagram">
            <div className="text-[0.8125rem] font-medium text-[var(--text-primary-color)]">
                {getDiagramName(definition)}
            </div>
        </Setting>
        <ActionButton
            isPrimary
            shortcut="↵"
            icon={<Pencil className="h-3.5 w-3.5" />}
            onClick={() => useMermaidDialogStore.getState().open({ kind: "edit", id })}
        >
            Edit diagram
        </ActionButton>
    </BlockSettings>
);

/** In Excalidraw's sidebar while a Mermaid block is selected */
export const MermaidMenuContainer = () => {
    const selected = useMermaidDialogStore(state => state.selected);
    if (!selected) return null;
    return createPortal(<MermaidMenu {...selected} />, NativeBlockSettings.container);
};
