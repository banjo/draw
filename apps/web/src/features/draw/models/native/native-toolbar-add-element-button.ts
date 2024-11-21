import { logger } from "@/utils/logger";
import { NativeToolbarButton } from "./native-toolbar-button";

const ADD_ELEMENT_ID = "add-element-button";

const PLUS_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus"><path d="M5 12h14"/><path d="M12 5v14"/></svg>';
const KEYBINDING = "+";

const createPlusIcon = () => {
    const container = document.createElement("div");
    container.innerHTML = PLUS_SVG;
    const svg = container.firstChild;
    if (!(svg instanceof SVGElement)) {
        throw new TypeError("Expected SVGElement");
    }
    return svg;
};

class NativeToolbarAddElementButtonClass {
    private element: HTMLLabelElement | null = null;
    private keybinding = KEYBINDING;

    constructor() {}

    public parse() {
        const element = NativeToolbarButton.parseById(ADD_ELEMENT_ID);
        if (!element) {
            throw new Error("Element not found");
        }

        this.element = element;
    }

    public create({ onClick }: { onClick: () => void }) {
        this.element = NativeToolbarButton.create({
            id: ADD_ELEMENT_ID,
            title: "Add element",
            icon: createPlusIcon(),
            keybinding: this.keybinding,
            onClick,
            includeInput: false,
        });
    }

    public get() {
        if (!this.element) {
            throw new Error("Element not found");
        }
        return this.element;
    }

    public isSelected() {
        if (!this.element) {
            throw new Error("Element not found");
        }
        const input = this.element.querySelector("input");
        if (!input) {
            throw new Error("Input not found");
        }
        return input.checked;
    }

    public getKeybinding() {
        return this.keybinding;
    }

    public getId() {
        if (!this.element) {
            throw new Error("Element not found");
        }

        return this.element.id;
    }
}

export const NativeToolbarAddElementButton = new NativeToolbarAddElementButtonClass();
