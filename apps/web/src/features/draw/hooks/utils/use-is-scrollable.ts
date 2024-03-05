import { useEffect, useRef, useState } from "react";

type In = {
    dependencies: unknown[];
};

export const useIsScrollable = <T extends Element>({ dependencies }: In) => {
    const scrollContainerRef = useRef<T>(null);
    const [isScrollable, setIsScrollable] = useState(false);

    useEffect(() => {
        const checkScrollable = () => {
            if (!scrollContainerRef.current) return;
            const container = scrollContainerRef.current;
            const scrollBottom =
                container.scrollHeight - container.scrollTop - container.clientHeight;

            const isAtBottom = scrollBottom <= 1; // You might need a small threshold, like 1px
            const scrollable = !isAtBottom && container.scrollHeight > container.clientHeight;
            setIsScrollable(scrollable);
        };

        checkScrollable();
        window.addEventListener("resize", checkScrollable);
        scrollContainerRef.current?.addEventListener("scroll", checkScrollable);

        return () => {
            window.removeEventListener("resize", checkScrollable);
            if (scrollContainerRef.current) {
                scrollContainerRef.current.removeEventListener("scroll", checkScrollable);
            }
        };
    }, dependencies);
    return {
        scrollContainerRef,
        isScrollable,
    };
};
