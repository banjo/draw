import { waitForElement as waitForElementUtil } from "@/utils/dom";

class NativeHelpDialogClass {
    private element: HTMLDivElement | null = null;
    private querySelector = ".HelpDialog";

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

    public hideHelpHeader() {
        const helpHeader = this.element?.querySelector(".HelpDialog__header");
        helpHeader?.setAttribute("style", "display: none");
    }

    public async waitForElement() {
        await waitForElementUtil(this.querySelector);
        this.parse();
    }
}

export const NativeHelpDialog = new NativeHelpDialogClass();
