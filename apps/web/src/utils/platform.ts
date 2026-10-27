export const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform);

/** How the shortcut modifier is shown: ⌘ on macOS, Ctrl elsewhere */
export const MODIFIER_LABEL = IS_MAC ? "⌘" : "Ctrl";
