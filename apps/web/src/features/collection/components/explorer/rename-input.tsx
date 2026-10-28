import { cn } from "ui";
import { FocusEvent, KeyboardEvent, useRef } from "react";

type Props = {
    initialValue: string;
    placeholder?: string;
    /** Called with the new name, if it's not empty and changed */
    onCommit: (value: string) => void;
    onDone: () => void;
    className?: string;
};

/** An inline name field: Enter or clicking away saves, Escape cancels */
export const RenameInput = ({ initialValue, placeholder, onCommit, onDone, className }: Props) => {
    const isDone = useRef(false);

    const finish = (value: string | null) => {
        if (isDone.current) return;
        isDone.current = true;
        const name = value?.trim();
        if (name && name !== initialValue) onCommit(name);
        onDone();
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        // Keep Excalidraw's shortcuts out of the field
        event.stopPropagation();
        if (event.key === "Enter") finish(event.currentTarget.value);
        if (event.key === "Escape") finish(null);
    };

    return (
        <input
            autoFocus
            defaultValue={initialValue}
            placeholder={placeholder}
            maxLength={100}
            onFocus={(event: FocusEvent<HTMLInputElement>) => event.currentTarget.select()}
            onKeyDown={onKeyDown}
            onBlur={event => finish(event.currentTarget.value)}
            onClick={event => event.preventDefault()}
            className={cn(
                // Important, over Excalidraw's focus shadow
                "min-w-0 flex-1 rounded bg-[--island-bg-color] px-1 -mx-1 text-[--text-primary-color] outline-none !ring-2 ring-[--color-primary]",
                className
            )}
        />
    );
};
