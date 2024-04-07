export const NativeAppMenuLeft = () => {
    const element = document.querySelector(".App-menu__left");

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

    return {
        hide,
        show,
    };
};
