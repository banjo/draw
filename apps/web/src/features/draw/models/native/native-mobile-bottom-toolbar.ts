class NativeMobileBottomToolbarClass {
    private element: HTMLDivElement | null = null;
    private querySelector = ".App-toolbar";

    constructor() {}

    public parse() {
        this.element = document.querySelector<HTMLDivElement>(this.querySelector);

        if (!this.element) {
            throw new Error(`Element with query selector ${this.querySelector} not found`);
        }
    }

    public hide() {
        this.element?.setAttribute("style", "display: none");
    }

    public show() {
        this.element?.setAttribute("style", "display: block");
    }

    public hideEditButton() {
        const editButton = document.querySelector('.ToolIcon_type_button[aria-label="Edit"]');
        if (editButton) {
            editButton.setAttribute("style", "display: none");
        }
    }

    public showEditButton() {
        const editButton = document.querySelector('.ToolIcon_type_button[aria-label="Edit"]');
        if (editButton) {
            editButton.setAttribute("style", "display: block");
        }
    }
}

export const NativeMobileBottomToolbar = new NativeMobileBottomToolbarClass();
