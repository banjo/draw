import { useChangeElementStore } from "@/stores/use-change-element-store";
import { useEffect, useState } from "react";

export const useChangeElementTimer = () => {
    const [showChangeElementByTime, setShowChangeElementByTime] = useState(true);
    const showChangeElementDialog = useChangeElementStore(s => s.showChangeElementDialog);

    useEffect(() => {
        if (showChangeElementDialog) {
            const timeout = setTimeout(() => {
                setShowChangeElementByTime(false);
            }, 2000);

            return () => clearTimeout(timeout);
        }
    }, [showChangeElementDialog]);

    useEffect(() => {
        if (!showChangeElementDialog) {
            setShowChangeElementByTime(true);
        }
    }, [showChangeElementDialog]);

    return { showChangeElementByTime };
};
