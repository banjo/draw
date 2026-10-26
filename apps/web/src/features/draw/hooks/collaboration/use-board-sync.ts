import { CustomDataUtil } from "@/features/draw/utils/custom-data-util";
import { trpc } from "@/lib/trpc";
import { logger } from "@/utils/logger";
import { isEqual, Maybe } from "@banjoanton/utils";
import { ExcalidrawApi, ExcalidrawElement, ExcalidrawElements } from "common";
import { useCallback, useLayoutEffect, useRef } from "react";

const SYNC_DELAY = 30;
const RETRY_DELAY = 1000;

type In = {
    slug: Maybe<string>;
    excalidrawApi: Maybe<ExcalidrawApi>;
};

const versionKey = (element: Pick<ExcalidrawElement, "version" | "versionNonce">) =>
    `${element.version}:${element.versionNonce}`;

const getVisibleOrder = (elements: ExcalidrawElements) =>
    elements.filter(element => !element.isDeleted).map(element => element.id);

const getSyncableElements = (excalidrawApi: ExcalidrawApi) =>
    excalidrawApi
        .getSceneElementsIncludingDeleted()
        .filter(element => !CustomDataUtil.isShadowElement(element));

/**
 * Sends local changes to the server. Instead of sending each change on its own, it compares
 * the scene with what the server already has (by version), so nothing is lost when changes
 * come quickly, and elements edited in place are picked up too.
 */
export const useBoardSync = ({ slug, excalidrawApi }: In) => {
    const utils = trpc.useUtils();

    // Element id → version the server has, and the order it has
    const syncedVersions = useRef(new Map<string, string>());
    const syncedOrder = useRef<string[]>([]);
    const timer = useRef<ReturnType<typeof setTimeout>>();
    const sendRef = useRef<() => void>(() => {});

    const schedule = useCallback((delay = SYNC_DELAY) => {
        if (timer.current) return;
        timer.current = setTimeout(() => sendRef.current(), delay);
    }, []);

    const send = () => {
        timer.current = undefined;
        if (!slug || !excalidrawApi) return;

        const elements = getSyncableElements(excalidrawApi);
        const changed = elements.filter(element => {
            const synced = syncedVersions.current.get(element.id);
            // Created and deleted before it was ever sent
            if (synced === undefined) return !element.isDeleted;
            return synced !== versionKey(element);
        });

        const order = getVisibleOrder(elements);
        const orderChanged = order.length > 0 && !isEqual(order, syncedOrder.current);

        if (changed.length === 0 && !orderChanged) return;

        const previousVersions = changed.map(
            element => [element.id, syncedVersions.current.get(element.id)] as const
        );
        const previousOrder = syncedOrder.current;
        const sentVersions = changed.map(element => [element.id, versionKey(element)] as const);

        changed.forEach(element => syncedVersions.current.set(element.id, versionKey(element)));
        if (orderChanged) syncedOrder.current = order;

        utils.client.collaboration.updateBoard
            .mutate({
                slug,
                deltaBoardUpdate: {
                    // Copy, as Excalidraw changes elements in place before a queued message is sent
                    excalidrawElements: structuredClone(changed),
                    order: orderChanged ? order : undefined,
                },
            })
            .catch(error => {
                logger.error({ error, slug }, "Could not send changes, retrying");

                // Mark them as not sent, unless they changed again since
                previousVersions.forEach(([id, previous], index) => {
                    if (syncedVersions.current.get(id) !== sentVersions[index]?.[1]) return;
                    if (previous === undefined) {
                        syncedVersions.current.delete(id);
                    } else {
                        syncedVersions.current.set(id, previous);
                    }
                });
                if (orderChanged && syncedOrder.current === order) {
                    syncedOrder.current = previousOrder;
                }

                schedule(RETRY_DELAY);
            });
    };

    sendRef.current = send;

    /** Everything in the full board from the server is already synced. */
    const setSynced = useCallback((elements: ExcalidrawElements) => {
        syncedVersions.current = new Map(
            elements.map(element => [element.id, versionKey(element)])
        );
        syncedOrder.current = getVisibleOrder(elements);
    }, []);

    /** Remote elements that were applied locally are synced, so they aren't sent back. */
    const markSynced = useCallback(
        (applied: ExcalidrawElements, before: ExcalidrawElements, after: ExcalidrawElements) => {
            applied.forEach(element => syncedVersions.current.set(element.id, versionKey(element)));

            // Only take the new order if there was no local order change waiting to be sent
            if (isEqual(getVisibleOrder(before), syncedOrder.current)) {
                syncedOrder.current = getVisibleOrder(after);
            }
        },
        []
    );

    // Send what's left before the drawing unmounts, e.g. when switching drawings. A layout
    // effect runs before Excalidraw clears its scene on unmount.
    useLayoutEffect(
        () => () => {
            clearTimeout(timer.current);
            sendRef.current();
        },
        []
    );

    return { schedule, setSynced, markSynced };
};
