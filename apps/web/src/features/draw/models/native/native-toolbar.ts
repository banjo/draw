import { logger } from "@/utils/logger";
import { debounce } from "@banjoanton/utils";

type AddNewButtonProps = {
    position: number;
    button: HTMLLabelElement;
};

class NativeToolbarClass {
    private element: HTMLDivElement | null = null;
    private querySelector = ".App-toolbar";
    private stackQuerySelector = ".Stack";

    constructor() {}

    public parse() {
        this.element = document.querySelector<HTMLDivElement>(this.querySelector);

        if (!this.element) {
            logger.trace(`Element with query selector ${this.querySelector} not found`);
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

    public addNewButton(props: AddNewButtonProps) {
        const { position, button } = props;
        if (!this.element) {
            logger.error("Element is not defined");
            return;
        }
        const stack = this.element.querySelector(this.stackQuerySelector);

        if (!stack) {
            logger.error("Stack element not found");
            return;
        }

        const existingButton = stack.children[position];
        if (!existingButton) {
            logger.error("Existing button not found");
            return;
        }

        existingButton.before(button);
    }

    public buttonExists(id: string) {
        if (!this.element) {
            logger.error("Element is not defined");
            return false;
        }
        const element = this.element.querySelector(`#${id}`);
        return Boolean(element);
    }

    public onResize(callback: () => void, debounceTime = 0) {
        this.parse();
        if (!this.element) {
            return;
        }
        const debounced = debounce(callback, debounceTime);

        const observer = new ResizeObserver(() => {
            debounced();
        });

        observer.observe(document.body);
    }
}

export const NativeToolbar = new NativeToolbarClass();
