import { CustomElementType } from "common";
import { Circle, Code, Diamond, LucideIcon, RectangleHorizontalIcon, Table2 } from "lucide-react";

/** "shape" is a plain Excalidraw shape, "block" one of BanjoDraw's own elements */
export type ShapeKind = "shape" | "block";

export type Shape = {
    type: CustomElementType;
    kind: ShapeKind;
    Icon: LucideIcon;
    title?: string;
    description?: string;
    /** Other words it's found by, e.g. "database" for a model */
    tags: string[];
};

export const shapes: Shape[] = [
    {
        type: "rectangle",
        kind: "shape",
        Icon: RectangleHorizontalIcon,
        title: "Rectangle",
        description: "A simple rectangle shape",
        tags: ["box", "square", "container", "node"],
    },
    {
        type: "ellipse",
        kind: "shape",
        Icon: Circle,
        title: "Ellipse",
        description: "A simple ellipse shape",
        tags: ["circle", "oval", "round"],
    },
    {
        type: "diamond",
        kind: "shape",
        Icon: Diamond,
        title: "Diamond",
        description: "A simple diamond shape",
        tags: ["decision", "condition", "rhombus"],
    },
    {
        type: "codeblock",
        kind: "block",
        Icon: Code,
        title: "Code Block",
        description: "A code block with syntax highlighting",
        tags: ["code", "snippet", "syntax", "programming", "source"],
    },
    {
        type: "model",
        kind: "block",
        Icon: Table2,
        title: "Model",
        description: "A table for modelling simple entities",
        tags: ["table", "entity", "database", "schema", "class", "data"],
    },
];
