import { waitForElement as waitForElementUtil } from "@/utils/dom";

class NativeHelpButtonClass {
    private element: HTMLDivElement | null = null;
    private button: HTMLButtonElement | null = null;
    private querySelector = ".layer-ui__wrapper__footer-right";

    constructor() {}

    public parse() {
        this.element = document.querySelector<HTMLDivElement>(this.querySelector);

        if (!this.element) {
            throw new Error(`Element with query selector ${this.querySelector} not found`);
        }

        this.button = this.element.querySelector<HTMLButtonElement>("button");
    }

    public focus() {
        this.element?.focus();
    }

    public blur() {
        this.element?.blur();
    }

    public addOnClick(onClick: (e: MouseEvent) => void) {
        this.button?.addEventListener("click", onClick);
    }

    public async waitForElement() {
        await waitForElementUtil(this.querySelector);
        this.parse();
    }
}

export const NativeHelpButton = new NativeHelpButtonClass();
