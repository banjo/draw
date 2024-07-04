import { CustomElementType } from "common";
import { Circle, Code, Diamond, LucideIcon, RectangleHorizontalIcon, Table2 } from "lucide-react";

export type Shape = {
    type: CustomElementType;
    Icon: LucideIcon;
    title?: string;
    description?: string;
};

export const shapes: Shape[] = [
    {
        type: "rectangle",
        Icon: RectangleHorizontalIcon,
        title: "Rectangle",
        description: "A simple rectangle shape",
    },
    { type: "ellipse", Icon: Circle, title: "Ellipse", description: "A simple ellipse shape" },
    { type: "diamond", Icon: Diamond, title: "Diamond", description: "A simple diamond shape" },
    {
        type: "codeblock",
        Icon: Code,
        title: "Code Block",
        description: "A code block with syntax highlighting",
    },
    {
        type: "model",
        Icon: Table2,
        title: "Model",
        description: "A table for modelling simple entities",
    },
];
