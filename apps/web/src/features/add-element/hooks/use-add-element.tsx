import { useGlobal } from "@/contexts/global-context";
import { isTypingTarget } from "@/features/draw/hooks/base/use-keyboard";
import { NativeContainer } from "@/features/draw/models/native/native-container";
import { canEditDrawing } from "@/features/share/stores/use-drawing-access-store";
import { useAddElementStore } from "@/stores/use-add-element-store";
import { useEffect, useRef } from "react";
import { AddElementPalette, PALETTE_ATTRIBUTE } from "../components/add-element-palette";
import { ClientPoint } from "./use-insert-element";
import { AddElementService } from "../services/add-element-service";

const isPaletteShortcut = (event: KeyboardEvent) =>
    (event.metaKey || event.ctrlKey) &&
    !event.shiftKey &&
    !event.altKey &&
    event.key.toLowerCase() === "k";

type Pointer = ClientPoint & { overCanvas: boolean };

/**
 * The + button, the + key and ⌘K / Ctrl+K open the palette for adding shapes, blocks and
 * icons. ⌘K is Excalidraw's "Add link", which stays in the right-click menu.
 */
export const useAddElement = () => {
    const { excalidrawApi } = useGlobal();
    const isOpen = useAddElementStore(s => s.isOpen);
    const placement = useAddElementStore(s => s.placement);
    const pointer = useRef<Pointer>();

    useEffect(() => {
        if (!excalidrawApi) return;

        AddElementService.init({
            onClick: () => useAddElementStore.getState().toggle("center"),
        });
    }, [excalidrawApi]);

    useEffect(() => {
        if (!excalidrawApi) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (!isPaletteShortcut(event)) return;
            // Adding needs a drawing you can change
            if (!canEditDrawing()) return;
            const inPalette =
                event.target instanceof Element && event.target.closest(`[${PALETTE_ATTRIBUTE}]`);
            if (!inPalette && isTypingTarget(event.target)) return;

            event.preventDefault();
            event.stopPropagation();
            useAddElementStore.getState().toggle("pointer");
        };

        // Where the mouse is, so the shortcut adds things there
        const onPointerMove = (event: PointerEvent) => {
            pointer.current = {
                clientX: event.clientX,
                clientY: event.clientY,
                overCanvas:
                    event.target instanceof HTMLCanvasElement &&
                    event.target.closest(".excalidraw") !== null,
            };
        };

        // Captured on the window, before Excalidraw and the browser see it
        window.addEventListener("keydown", onKeyDown, true);
        window.addEventListener("pointermove", onPointerMove, { capture: true, passive: true });
        return () => {
            window.removeEventListener("keydown", onKeyDown, true);
            window.removeEventListener("pointermove", onPointerMove, true);
        };
    }, [excalidrawApi]);

    const close = () => {
        useAddElementStore.getState().close();
        NativeContainer.parse();
        NativeContainer.focus();
    };

    const render = () => {
        if (!excalidrawApi || !isOpen) return null;

        const at =
            placement === "pointer" && pointer.current?.overCanvas ? pointer.current : undefined;
        return <AddElementPalette pointer={at} onClose={close} />;
    };

    return { render };
};
