import { useAuth } from "@/contexts/auth-context";
import { CollectionPalette } from "@/features/collection/components/palette/collection-palette";
import { usePaletteStore } from "@/features/collection/stores/use-palette-store";
import { NativeContainer } from "@/features/draw/models/native/native-container";
import { useEffect } from "react";

const isPaletteShortcut = (event: KeyboardEvent) =>
    (event.metaKey || event.ctrlKey) &&
    !event.shiftKey &&
    !event.altKey &&
    event.key.toLowerCase() === "o";

/** ⌘O / Ctrl+O finds a drawing in the collection, instead of Excalidraw's "open file" */
export const useCollectionPalette = () => {
    const { isAuthenticated } = useAuth();
    const isOpen = usePaletteStore(s => s.isOpen);
    const setIsOpen = usePaletteStore(s => s.setIsOpen);

    useEffect(() => {
        if (!isAuthenticated) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (!isPaletteShortcut(event)) return;
            event.preventDefault();
            event.stopPropagation();
            setIsOpen(!usePaletteStore.getState().isOpen);
        };

        // Captured on the window, before Excalidraw and the browser see it
        window.addEventListener("keydown", onKeyDown, true);
        return () => window.removeEventListener("keydown", onKeyDown, true);
    }, [isAuthenticated, setIsOpen]);

    const close = () => {
        setIsOpen(false);
        NativeContainer.parse();
        NativeContainer.focus();
    };

    const render = () => (isOpen && isAuthenticated ? <CollectionPalette onClose={close} /> : null);

    return { render };
};
