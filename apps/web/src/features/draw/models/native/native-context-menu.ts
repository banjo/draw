import { logger } from "@/utils/logger";

type UpdateEntryProps = {
    dataTestId: string;
    label: string;
    shortcut?: string;
    onClick?: (event: MouseEvent) => void;
};

class NativeContextMenuClass {
    private element: HTMLElement | null = null;
    private querySelector = ".context-menu";

    constructor() {}

    public parse() {
        this.element = document.querySelector<HTMLElement>(this.querySelector);

        if (!this.element) {
            logger.error(`Element with query selector ${this.querySelector} not found`);
            return false;
        }

        return true;
    }

    public focus() {
        this.element?.focus();
    }

    public blur() {
        this.element?.blur();
    }

    public getEntry(dataTestId: string) {
        return this.element?.querySelector(`[data-testid=${dataTestId}]`) as HTMLElement;
    }

    public removeMenu() {
        this.element?.remove();
    }

    public updateEntry({ dataTestId, label, onClick, shortcut }: UpdateEntryProps) {
        const entry = this.getEntry(dataTestId);
        if (!entry) return;

        const labelElement = entry.querySelector(".context-menu-item__label");
        if (labelElement) {
            labelElement.textContent = label;
        }

        const shortcutElement = entry.querySelector(".context-menu-item__shortcut");
        if (shortcutElement) {
            shortcutElement.textContent = shortcut ?? "";
        }

        const button = entry.querySelector("button");

        if (button && onClick) {
            const customOnClick = (event: MouseEvent) => {
                event.stopPropagation();
                onClick(event);
                this.removeMenu();
            };
            button.onclick = customOnClick;
        }
    }
}

export const NativeContextMenu = new NativeContextMenuClass();
