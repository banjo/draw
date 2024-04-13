export const NativeContextMenu = () => {
    const element = document.querySelector<HTMLElement>(".context-menu");

    const focus = () => {
        element?.focus();
    };

    const blur = () => {
        element?.blur();
    };

    const getEntry = (dataTestId: string) => {
        return element?.querySelector(`[data-testid=${dataTestId}]`) as HTMLElement;
    };

    const removeMenu = () => {
        element?.remove();
    };

    type UpdateEntryProps = {
        dataTestId: string;
        label: string;
        shortcut?: string;
        onClick?: (event: MouseEvent) => void;
    };
    const updateEntry = ({ dataTestId, label, onClick, shortcut }: UpdateEntryProps) => {
        const entry = getEntry(dataTestId);
        if (!entry) return;

        const labelElement = entry.querySelector(".context-menu-item__label");
        if (labelElement) {
            labelElement.textContent = label;
        }

        const shortcutElement = entry.querySelector(".context-menu-item__shortcut");
        if (shortcutElement) {
            shortcutElement.textContent = shortcut ?? "";
        }

        const button = entry.querySelector("button");

        if (button && onClick) {
            const customOnClick = (event: MouseEvent) => {
                event.stopPropagation();
                onClick(event);
                removeMenu();
            };
            button.onclick = customOnClick;
        }
    };

    return {
        focus,
        blur,
        getEntry,
        updateEntry,
        removeMenu,
    };
};
