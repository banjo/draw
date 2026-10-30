import { MODIFIER_LABEL } from "@/utils/platform";
import { AI_FREE_DAILY_LIMIT } from "common";

export type Feature = {
    /** Saved once it's been shown. Never change it, or the feature shows again. */
    id: string;
    title: string;
    /** One line, for the small cards */
    short: string;
    description: string;
    keys?: string[];
    /**
     * How big its card is in the list of all features: "hero" takes two by two, with the whole
     * description. The most important ones.
     */
    size?: "hero" | "wide";
};

/**
 * What BanjoDraw adds to Excalidraw, most important first, in the order they're shown. A new
 * feature needs a new id: people who have seen the others get a "What's new" with only the
 * new ones. Each needs an illustration in `illustrations.ts`.
 */
export const FEATURES: Feature[] = [
    {
        id: "blocks",
        title: "Blocks",
        short: "Code, Markdown, tables, charts, diagrams, and more.",
        description: `Code, database models, notes, tables, charts, Mermaid, swimlanes, and link cards. Add one from Blocks or ${MODIFIER_LABEL} K, and double-click to edit it.`,
        size: "hero",
    },
    {
        id: "ai",
        title: "Create with AI",
        short: "Describe a diagram, get one you can edit.",
        description: `Describe a diagram and get shapes and blocks you can edit, or Mermaid. Ask for changes before inserting it, or select something to change it. ${AI_FREE_DAILY_LIMIT} a day for free.`,
        size: "hero",
    },
    {
        id: "collection",
        title: "Your collection",
        short: "Many drawings, synced across devices.",
        description: "Sign in to keep as many drawings as you like, synced between your devices.",
        size: "hero",
    },
    {
        id: "add-element",
        title: "Add shapes and icons",
        short: "Shapes, blocks, and thousands of icons.",
        description:
            "Search shapes, blocks, and thousands of icons, emojis, and logos. It goes where the mouse is.",
        keys: [MODIFIER_LABEL, "K"],
    },
    {
        id: "collaboration",
        title: "Draw together",
        short: "Share a link, see each other.",
        description: "Share a link and draw together, with everyone's cursors.",
    },
    {
        id: "extend",
        title: "Add a connected shape",
        short: "Grow a diagram from the keyboard.",
        description: `Hold ${MODIFIER_LABEL} and press an arrow to add a connected shape, or drag a dot around it.`,
        keys: [MODIFIER_LABEL, "→"],
    },
    {
        id: "change-shape",
        title: "Change a shape",
        short: "Swap a shape, keep its place.",
        description: "Turn the selected shape into another shape, a block, or a note.",
        keys: ["Tab"],
    },
    {
        id: "smart-copy",
        title: "Smart copy",
        short: "Duplicate right next to it.",
        description: "Copies the selection right next to it.",
        keys: [MODIFIER_LABEL, "Enter"],
    },
    {
        id: "find-drawing",
        title: "Find a drawing",
        short: "Jump to any drawing by name.",
        description: "Search your collection and jump to any drawing.",
        keys: [MODIFIER_LABEL, "O"],
    },
    {
        id: "folders",
        title: "Folders",
        short: "Sort your collection.",
        description: "Sort drawings into folders, and pin the ones you use most.",
    },
];
