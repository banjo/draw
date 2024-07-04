import { CustomElementType } from "common";
import { Circle, Code, Diamond, LucideIcon, RectangleHorizontalIcon, Table2 } from "lucide-react";

export type Shape = {
    type: CustomElementType;
    Icon: LucideIcon;
    title?: string;
};

export const shapes: Shape[] = [
    { type: "rectangle", Icon: RectangleHorizontalIcon, title: "Rectangle" },
    { type: "ellipse", Icon: Circle, title: "Ellipse" },
    { type: "diamond", Icon: Diamond, title: "Diamond" },
    { type: "codeblock", Icon: Code, title: "Code Block" },
    { type: "model", Icon: Table2, title: "Model" },
];
