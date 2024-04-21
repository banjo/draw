class NativeContinerClass {
    private element: HTMLDivElement | null = null;
    private querySelector = ".excalidraw-container";

    constructor() {}

    public parse() {
        this.element = document.querySelector<HTMLDivElement>(this.querySelector);

        if (!this.element) {
            throw new Error(`Element with query selector ${this.querySelector} not found`);
        }
    }

    public focus() {
        this.element?.focus();
    }

    public blur() {
        this.element?.blur();
    }
}

export const NativeContainer = new NativeContinerClass();
