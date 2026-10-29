import { MODIFIER_LABEL } from "@/utils/platform";

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
        description: `Code blocks, database models, Markdown notes, tables, charts, Mermaid diagrams, swimlanes, and link cards. Add one with ${MODIFIER_LABEL} K, double-click or press Enter to edit it, and change its look at the bottom. Paste a link or rows from a spreadsheet to make one.`,
        size: "hero",
    },
    {
        id: "collection",
        title: "Your collection",
        short: "Many drawings, synced across devices.",
        description:
            "Keep as many drawings as you like. Sign in and they're saved to your collection and synced between your devices, so you can start on your laptop and carry on from your phone. The drawing on the start page stays in this browser.",
        size: "hero",
    },
    {
        id: "add-element",
        title: "Add shapes and icons",
        short: "Shapes, blocks, and thousands of icons.",
        description: `Search shapes, blocks, and thousands of logos, emojis, flags, and icons, or browse one set. ${MODIFIER_LABEL} K adds it where the mouse is. It's also the + in the toolbar.`,
        keys: [MODIFIER_LABEL, "K"],
    },
    {
        id: "collaboration",
        title: "Draw together",
        short: "Share a link, see each other.",
        description:
            "Share gives you a link. Everyone with it can draw with you, and you see each other's cursors.",
    },
    {
        id: "extend",
        title: "Add a connected shape",
        short: "Grow a diagram from the keyboard.",
        description: `With a shape selected, hold ${MODIFIER_LABEL} and press an arrow to see where a connected shape goes. Let go to add it. Or drag one of the dots around the shape.`,
        keys: [MODIFIER_LABEL, "→"],
    },
    {
        id: "change-shape",
        title: "Change a shape",
        short: "Swap a shape, keep its place.",
        description:
            "With one shape selected, turn it into another shape, a code block, a model, a note, or a table.",
        keys: ["Tab"],
    },
    {
        id: "smart-copy",
        title: "Smart copy",
        short: "Duplicate right next to it.",
        description: "Copies the selection right next to it, with its text and groups.",
        keys: [MODIFIER_LABEL, "Enter"],
    },
    {
        id: "find-drawing",
        title: "Find a drawing",
        short: "Jump to any drawing by name.",
        description: `Press ${MODIFIER_LABEL} O to search your collection and jump to any drawing. Tab searches inside a folder.`,
        keys: [MODIFIER_LABEL, "O"],
    },
    {
        id: "folders",
        title: "Folders",
        short: "Sort your collection.",
        description:
            "Sort the drawings in your collection into folders, pin the ones you use most, and drag them where they belong.",
    },
];
