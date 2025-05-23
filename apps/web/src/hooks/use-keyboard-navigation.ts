import { createRef, useState } from "react";
import React from "react";

interface Props<T> {
    itemsToNavigate: T[];
    onClick: (item: T) => void;
}

export const useKeyboardNavigation = <T>({ itemsToNavigate, onClick }: Props<T>) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const refs = itemsToNavigate.map(() => createRef<HTMLDivElement>());

    const resetSelectedIndex = () => setSelectedIndex(0);

    const handleKeyboardNavigation = (e: React.KeyboardEvent<Element>) => {
        let newValue = 0;

        if (e.key === "ArrowUp") {
            e.preventDefault();
            newValue = (selectedIndex - 1 + itemsToNavigate.length) % itemsToNavigate.length;
            setSelectedIndex(newValue);
        }

        if (e.key === "ArrowDown" || e.key === "Tab") {
            e.preventDefault();
            newValue = (selectedIndex + 1) % itemsToNavigate.length;
            setSelectedIndex(newValue);
        }

        const ref = refs[newValue];
        ref?.current?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
        });

        if (e.key === "Enter") {
            e.preventDefault();
            if (!itemsToNavigate[selectedIndex]) return;
            onClick(itemsToNavigate[selectedIndex]);
        }
    };

    return { handleKeyboardNavigation, refs, selectedIndex, resetSelectedIndex };
};
