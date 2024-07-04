import { logger } from "@/utils/logger";

export type NativeToolbarButtonProps = {
    icon: Element;
    keybinding: string;
    title: string;
    id: string;
    onClick: () => void;
    includeInput?: boolean;
};

class NativeToolbarButtonClass {
    constructor() {}

    public parseById(id: string) {
        const element = document.getElementById(id) as HTMLLabelElement;
        if (!element) {
            logger.error("Element not found");
            return;
        }
        return element;
    }

    public create(props: NativeToolbarButtonProps) {
        const { icon, keybinding, title, id, onClick, includeInput } = props;
        const outerContainer = document.createElement("label");
        outerContainer.id = id;
        ["ToolIcon", "Shape", "fillable"].forEach(className => {
            outerContainer.classList.add(className);
        });
        outerContainer.title = title;

        const innerContainer = document.createElement("div");
        innerContainer.classList.add("ToolIcon__icon");

        innerContainer.append(icon);

        const binding = document.createElement("span");
        binding.classList.add("ToolIcon__keybinding");
        binding.textContent = keybinding;

        innerContainer.append(binding);

        if (includeInput) {
            const input = document.createElement("input");
            ["ToolIcon_type_radio", "ToolIcon_size_medium"].forEach(className => {
                input.classList.add(className);
            });
            input.type = "radio";
            input.addEventListener("click", onClick);

            outerContainer.append(input);
        } else {
            outerContainer.addEventListener("click", onClick);
        }

        outerContainer.append(innerContainer);

        return outerContainer;
    }

    public select(element: HTMLLabelElement) {
        const input = element.querySelector("input");
        if (!input) {
            throw new Error("Input not found");
        }

        input.checked = true;
    }

    public deselect(element: HTMLLabelElement) {
        const input = element.querySelector("input");
        if (!input) {
            throw new Error("Input not found");
        }
        input.checked = false;
    }
}

export const NativeToolbarButton = new NativeToolbarButtonClass();
