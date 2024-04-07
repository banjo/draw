import { Maybe } from "@banjoanton/utils";

class NativeAppMenuLeftModel {
    private _element: Maybe<Element>;

    // lazy load the element
    private get element(): Maybe<Element> {
        if (!this._element) {
            const appMenu = document.querySelector(".App-menu__left");
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
}

export const NativeAppMenuLeft = new NativeAppMenuLeftModel();
