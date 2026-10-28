import { MODIFIER_LABEL } from "@/utils/platform";

export type Feature = {
    /** Saved once it's been shown. Never change it, or the feature shows again. */
    id: string;
    title: string;
    /** One line, for the small cards */
    short: string;
    description: string;
    keys?: string[];
};

/**
 * What BanjoDraw adds to Excalidraw. Add new features at the end with a new id: people who
 * have seen the others get a "What's new" with only the new ones. Each needs an illustration
 * in `illustrations.ts`. The first one is the big card.
 */
export const FEATURES: Feature[] = [
    {
        id: "extend",
        title: "Add a connected shape",
        short: "Grow a diagram from the keyboard.",
        description: `With a shape selected, hold ${MODIFIER_LABEL} and press an arrow to see where a connected shape goes. Let go to add it. Or drag one of the dots around the shape.`,
        keys: [MODIFIER_LABEL, "→"],
    },
    {
        id: "add-element",
        title: "Add shapes and icons",
        short: "Shapes, code, models, and thousands of icons.",
        description:
            "Search shapes, code blocks, models, and thousands of icons, logos, and emojis. It's also the + in the toolbar.",
        keys: ["+"],
    },
    {
        id: "smart-copy",
        title: "Smart copy",
        short: "Duplicate right next to it.",
        description: "Copies the selection right next to it, with its text and groups.",
        keys: [MODIFIER_LABEL, "Enter"],
    },
    {
        id: "change-shape",
        title: "Change a shape",
        short: "Swap a shape, keep its place.",
        description:
            "With one shape selected, turn it into another shape, a code block, or a model.",
        keys: ["Tab"],
    },
    {
        id: "code-blocks",
        title: "Code blocks",
        short: "Highlighted code on the canvas.",
        description:
            "Code with syntax highlighting. Double-click one or press Enter to edit it, and pick the language at the bottom.",
    },
    {
        id: "models",
        title: "Models",
        short: "Database tables, sketched.",
        description: `Database models with a title and fields. Select one and press ${MODIFIER_LABEL} Enter to add a field.`,
    },
    {
        id: "collaboration",
        title: "Draw together",
        short: "Share a link, see each other.",
        description:
            "Share gives you a link. Everyone with it can draw with you, and you see each other's cursors.",
    },
    {
        id: "collection",
        title: "Your collection",
        short: "Save drawings, open them anywhere.",
        description:
            "The drawing on the start page stays in this browser. Sign in to save drawings to your collection and open them anywhere.",
    },
    {
        id: "folders",
        title: "Folders",
        short: "Sort your collection.",
        description:
            "Sort the drawings in your collection into folders, pin the ones you use most, and drag them where they belong.",
    },
    {
        id: "find-drawing",
        title: "Find a drawing",
        short: "Jump to any drawing by name.",
        description: `Press ${MODIFIER_LABEL} O to search your collection and jump to any drawing. Tab searches inside a folder.`,
        keys: [MODIFIER_LABEL, "O"],
    },
];
