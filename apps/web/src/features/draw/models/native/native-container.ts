import { Maybe } from "@banjoanton/utils";

class NativeContainerModel {
    private _element: Maybe<HTMLDivElement>;

    // lazy load the element
    private get element(): Maybe<HTMLDivElement> {
        if (!this._element) {
            const appMenu: HTMLDivElement | null = document.querySelector(".excalidraw-container");
            if (!appMenu) {
                return undefined;
            }
            this._element = appMenu;
        }
        return this._element;
    }

    focus() {
        this.element?.focus();
    }

    blur() {
        this.element?.blur();
    }
}

export const NativeContainer = new NativeContainerModel();
