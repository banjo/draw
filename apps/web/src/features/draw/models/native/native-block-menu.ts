import { ExcalidrawUtil } from "@/features/draw/utils/excalidraw-util";

const BLOCK_MENU_ID = "custom-block-menu";

/** A place in Excalidraw's footer for the selected block's settings, like a code block's language */
export const NativeBlockMenu = {
    init: () =>
        ExcalidrawUtil.createCustomNativeElement(BLOCK_MENU_ID, ".layer-ui__wrapper footer", 1),
    getContainer: () => document.getElementById(BLOCK_MENU_ID),
};
