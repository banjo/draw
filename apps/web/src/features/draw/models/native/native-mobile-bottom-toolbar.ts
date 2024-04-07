export const NativeMobileBottomToolbar = () => {
    const element = document.querySelector(".App-toolbar");

    const hide = () => {
        if (element) {
            element.setAttribute("style", "display: none");
        }
    };

    const show = () => {
        if (element) {
            element.setAttribute("style", "display: block");
        }
    };

    const hideEditButton = () => {
        const editButton = document.querySelector('.ToolIcon_type_button[aria-label="Edit"]');
        if (editButton) {
            editButton.setAttribute("style", "display: none");
        }
    };

    const showEditButton = () => {
        const editButton = document.querySelector('.ToolIcon_type_button[aria-label="Edit"]');
        if (editButton) {
            editButton.setAttribute("style", "display: block");
        }
    };

    return {
        hide,
        show,
        hideEditButton,
        showEditButton,
    };
};
