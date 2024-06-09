import { useVisualElementStore } from "@/stores/use-visual-element-store";
import { useEffect, useState } from "react";

export const useVisualElementTimer = () => {
    const [showElementByTime, setShowElementByTime] = useState(true);
    const showVisualElement = useVisualElementStore(s => s.showVisualElements);

    useEffect(() => {
        if (showVisualElement) {
            const timeout = setTimeout(() => {
                setShowElementByTime(false);
            }, 2000);

            return () => clearTimeout(timeout);
        }
    }, [showVisualElement]);

    useEffect(() => {
        if (!showVisualElement) {
            setShowElementByTime(true);
        }
    }, [showVisualElement]);

    return { showElementByTime };
};
