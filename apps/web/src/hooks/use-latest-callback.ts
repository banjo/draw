import { useCallback, useRef } from "react";

/**
 * A function that keeps its identity across renders but always calls the latest `fn`. Use it
 * for callbacks passed to memoised components, like Excalidraw, so they don't re-render.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useLatestCallback = <T extends (...args: any[]) => any>(fn: T): T => {
    const ref = useRef(fn);
    // Set during render, so it's current before Excalidraw's componentDidUpdate calls it
    ref.current = fn;
    return useCallback(((...args) => ref.current(...args)) as T, []);
};
