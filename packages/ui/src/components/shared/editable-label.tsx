import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import React from "react";

type In = {
    initialText: string;
    onChange?: (text: string) => void;
    startRef?: React.MutableRefObject<() => void>;
    allowEditing?: boolean;
};

export const EditableLabel = forwardRef(({ initialText, onChange, allowEditing }: In, ref) => {
    const [isEditing, setIsEditing] = useState(false);
    const [text, setText] = useState(initialText);
    // Enter saves; the blur that may follow when the field is removed must not undo it
    const committed = useRef(false);

    useImperativeHandle(ref, () => ({
        startEditing: () => {
            if (!allowEditing) return;
            committed.current = false;
            setIsEditing(true);
        },
        stopEditing: () => {
            setIsEditing(false);
            setText(initialText); // Reset the text when editing stops
        },
        setText: (newText: string) => {
            setText(newText);
        },
    }));

    const handleDoubleClick = () => {
        if (!allowEditing) return;
        committed.current = false;
        setIsEditing(true);
    };

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setText(event.target.value);
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
        const { key } = event;
        if (key === "Enter") {
            committed.current = true;
            setIsEditing(false);
            onChange?.(text);
        } else if (key === "Escape") {
            setText(initialText);
            setIsEditing(false);
        }
    };

    // Leaving the field without Enter discards the change
    const handleBlur = () => {
        if (!committed.current) setText(initialText);
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <input
                type="text"
                className="bg-zinc-100 border border-gray-300 
                rounded-md p-2
                font-sm h-6
                focus:outline-none focus:ring-0 
                focus:border-none 
                outline-none
                "
                value={text}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                // A click in the field shouldn't reach what's around it, like a card
                onClick={event => event.stopPropagation()}
                autoFocus
            />
        );
    }

    return <label onDoubleClick={handleDoubleClick}>{text}</label>;
});
