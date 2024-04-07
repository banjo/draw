class NativeAppMenuLeftModel {
    private element: Element;
    constructor() {
        const appMenu = document.querySelector(".App-menu__left");

        if (!appMenu) {
            throw new Error("App menu not found");
        }

        this.element = appMenu;
    }

    hide() {
        this.element.setAttribute("style", "display: none");
    }

    show() {
        this.element.setAttribute("style", "display: block");
    }
}

export const NativeAppMenuLeft = new NativeAppMenuLeftModel();
