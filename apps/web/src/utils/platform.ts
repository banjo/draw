export const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform);

/** How the shortcut modifier is shown: ⌘ on macOS, Ctrl elsewhere */
export const MODIFIER_LABEL = IS_MAC ? "⌘" : "Ctrl";

/** A shortcut as shown in menus: "⌘O" on macOS, "Ctrl+O" elsewhere */
export const formatShortcut = (key: string) => (IS_MAC ? `⌘${key}` : `Ctrl+${key}`);
