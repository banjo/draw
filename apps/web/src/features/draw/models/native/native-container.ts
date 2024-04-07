export const NativeContainer = () => {
    const element = document.querySelector<HTMLDivElement>(".excalidraw-container");

    const focus = () => {
        element?.focus();
    };

    const blur = () => {
        element?.blur();
    };

    return {
        focus,
        blur,
    };
};
