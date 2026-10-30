import { FrameUtil } from "@/features/draw/utils/frame-util";
import { CaptureUpdateAction, viewportCoordsToSceneCoords } from "@excalidraw/excalidraw";
import { ExcalidrawApi } from "common";
import type { ClientPoint } from "../hooks/use-insert-element";

/**
 * Moves just-added elements with the pointer until a click puts them down, as one undo step.
 * Escape takes them away again. Resolves with whether they were put down.
 */
export const placeWithPointer = (api: ExcalidrawApi, ids: string[], start: ClientPoint) =>
    new Promise<boolean>(resolve => {
        const added = new Set(ids);
        const listening = new AbortController();
        const stop = () => listening.abort();
        let last = viewportCoordsToSceneCoords(start, api.getAppState());
        // Selected once it's put down, so its handles and settings don't trail behind it
        const { selectedElementIds } = api.getAppState();
        // Back to the selection tool, e.g. from the rectangle picked to open the shapes, so
        // after putting it down the pointer selects and moves things again
        api.setActiveTool({ type: "selection" });
        api.updateScene({
            appState: { selectedElementIds: {} },
            captureUpdate: CaptureUpdateAction.NEVER,
        });

        const others = () =>
            api.getSceneElementsIncludingDeleted().filter(element => !added.has(element.id));
        const mine = () => api.getSceneElements().filter(element => added.has(element.id));

        const onPointerMove = (event: PointerEvent) => {
            const point = viewportCoordsToSceneCoords(event, api.getAppState());
            const dx = point.x - last.x;
            const dy = point.y - last.y;
            last = point;
            api.updateScene({
                elements: [
                    ...others(),
                    ...mine().map(element => ({
                        ...element,
                        x: element.x + dx,
                        y: element.y + dy,
                    })),
                ],
                captureUpdate: CaptureUpdateAction.NEVER,
            });
        };

        const swallow = (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
        };

        // Taken out unrecorded and put back recorded, so undo has it where it was put down
        const onPointerDown = (event: PointerEvent) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            stop();
            // Nor does the click that follows press what's under the pointer. It comes right
            // after the pointer is let go, if it comes at all.
            window.addEventListener("click", swallow, { capture: true, once: true });
            window.addEventListener(
                "pointerup",
                () => setTimeout(() => window.removeEventListener("click", swallow, true)),
                { capture: true, once: true }
            );
            onPointerMove(event);
            const placed = mine();
            // In a frame if it's put down in one, else out of the one it started in
            const outside = placed.map(element =>
                element.frameId && !added.has(element.frameId)
                    ? { ...element, frameId: null }
                    : element
            );
            const elements = FrameUtil.addToFrame(outside, api.getSceneElements());
            api.updateScene({ elements: others(), captureUpdate: CaptureUpdateAction.NEVER });
            api.updateScene({
                elements: [...others(), ...elements],
                appState: { selectedElementIds },
                captureUpdate: CaptureUpdateAction.IMMEDIATELY,
            });
            resolve(true);
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            stop();
            api.updateScene({ elements: others(), captureUpdate: CaptureUpdateAction.NEVER });
            resolve(false);
        };

        const options = { capture: true, signal: listening.signal };
        window.addEventListener("pointermove", onPointerMove, options);
        window.addEventListener("pointerdown", onPointerDown, options);
        window.addEventListener("keydown", onKeyDown, options);
    });
