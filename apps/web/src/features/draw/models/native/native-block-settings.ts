import { NativeSlot } from "./native-slot";

/**
 * The selected block's settings, like a code block's language, at the top of Excalidraw's
 * sidebar for the selection (or its bottom bar on phones)
 */
export const NativeBlockSettings = new NativeSlot(
    "custom-block-settings",
    ".App-menu__left .panelColumn, .App-bottom-bar .panelColumn",
    "first"
);
