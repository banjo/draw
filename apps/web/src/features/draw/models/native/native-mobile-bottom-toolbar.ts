import { Maybe } from "@banjoanton/utils";

class NativeMobileBottomToolbarModel {
    private _element: Maybe<Element>;

    // lazy load the element
    private get element(): Maybe<Element> {
        if (!this._element) {
            const appMenu = document.querySelector(".App-toolbar");
            if (!appMenu) {
                return undefined;
            }
            this._element = appMenu;
        }
        return this._element;
    }

    hide() {
        this.element?.setAttribute("style", "display: none");
    }

    show() {
        this.element?.setAttribute("style", "display: block");
    }

    hideEditButton() {
        const editButton = document.querySelector('.ToolIcon_type_button[aria-label="Edit"]');
        if (editButton) {
            editButton.setAttribute("style", "display: none");
        }
    }

    showEditButton() {
        const editButton = document.querySelector('.ToolIcon_type_button[aria-label="Edit"]');
        if (editButton) {
            editButton.setAttribute("style", "display: block");
        }
    }
}

export const NativeMobileBottomToolbar = new NativeMobileBottomToolbarModel();
