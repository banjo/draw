const ATTACH_EVENT = "native-slot-attach";

/**
 * A place of our own inside Excalidraw's UI, for a React portal. Excalidraw unmounts parts of
 * its UI, like the sidebar when nothing is selected, so the place is put back whenever its
 * parent is there again.
 */
export class NativeSlot {
    readonly container: HTMLDivElement;
    private observer: MutationObserver | undefined;

    constructor(
        id: string,
        private parentSelector: string,
        private position: "first" | "last"
    ) {
        this.container = document.createElement("div");
        this.container.id = id;
        this.container.classList.add("custom-native-element");
    }

    private attach() {
        const parent = document.querySelector(this.parentSelector);
        if (!parent) return;
        if (this.position === "first" && parent.firstElementChild !== this.container) {
            parent.prepend(this.container);
        } else if (this.position === "last" && this.container.parentElement !== parent) {
            parent.append(this.container);
        } else {
            return;
        }
        this.container.dispatchEvent(new Event(ATTACH_EVENT));
    }

    /** Calls back with its parent now and each time it's put in a new one */
    onAttach(callback: (parent: HTMLElement | null) => void) {
        const listener = () => callback(this.container.parentElement);
        listener();
        this.container.addEventListener(ATTACH_EVENT, listener);
        return () => this.container.removeEventListener(ATTACH_EVENT, listener);
    }

    /** Keeps it in its place while Excalidraw changes its UI. Returns a function that stops. */
    watch() {
        const root = document.querySelector(".excalidraw");
        this.attach();
        if (!root) return () => undefined;

        this.observer?.disconnect();
        this.observer = new MutationObserver(() => this.attach());
        this.observer.observe(root, { childList: true, subtree: true });
        return () => this.observer?.disconnect();
    }
}
