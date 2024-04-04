import { useEffect, useRef, useState } from "react";

type In = {};

export const useSelectElementDialog = () => {
    const selectElementRef = useRef<HTMLDivElement>(null);
    const [showSelectElementDialog, setShowSelectElementDialog] = useState(false);

    // Focus on the dialog when it is shown
    useEffect(() => {
        if (showSelectElementDialog) {
            selectElementRef.current?.setAttribute("tabIndex", "-1");
            selectElementRef.current?.focus();
        }
    }, [showSelectElementDialog]);

    return {
        selectElementRef,
        showSelectElementDialog,
        setShowSelectElementDialog,
    };
};
