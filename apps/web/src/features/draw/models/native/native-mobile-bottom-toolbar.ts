class NativeMobileBottomToolbarModel {
    private element: Element;
    constructor() {
        const appMenu = document.querySelector(".App-toolbar");

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
