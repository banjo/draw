import { trpc } from "@/lib/trpc";
import { logger } from "@/utils/logger";
import { isDefined, Maybe } from "@banjoanton/utils";
import { Collaborator, CollaboratorPointer, Gesture } from "@excalidraw/excalidraw/types";
import { ExcalidrawApi } from "common";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import generateName from "sillyname";

type In = {
    slug?: string;
    excalidrawApi: Maybe<ExcalidrawApi>;
};

type PointerUpdateData = {
    pointer: CollaboratorPointer;
    button: "down" | "up";
    pointersMap: Gesture["pointers"];
};

const DEFAULT_MOUSE_POSITION: CollaboratorPointer = {
    x: 0,
    y: 0,
    tool: "pointer",
};

const MOUSE_THROTTLE_TIME = 30;

/**
 * Shows the other collaborators' cursors, and sends your own. The pointer is kept out of React
 * state, so moving the mouse doesn't re-render the drawing, and it's only sent while someone
 * else is on the drawing.
 */
export const usePointerCollaboration = ({ slug, excalidrawApi }: In) => {
    // Shown when not signed in. Signed-in users get their name from the server.
    const anonymousName = useMemo(() => generateName(), []);
    const [isCollaborating, setIsCollaborating] = useState(false);
    const utils = trpc.useUtils();

    const pointer = useRef(DEFAULT_MOUSE_POSITION);
    const timer = useRef<ReturnType<typeof setTimeout>>();
    const othersPresent = useRef(false);
    // Your own moves come back as an unchanged list of the others, which is skipped
    const lastOthers = useRef("");

    const send = useCallback(() => {
        clearTimeout(timer.current);
        timer.current = undefined;
        if (!slug) return;

        const { x, y } = pointer.current;
        utils.client.collaboration.updateCollaborator
            .mutate({ slug, collaborator: { name: anonymousName, x, y } })
            .catch(error => logger.error({ error, slug }, "Could not send the pointer"));
    }, [slug]);

    // The first update tells the server you're on the drawing, so others see you
    useEffect(() => {
        send();
        return () => clearTimeout(timer.current);
    }, [send]);

    trpc.collaboration.onCollaboratorChange.useSubscription(
        { slug: slug ?? "" },
        {
            enabled: isDefined(slug),
            // Everyone else on the drawing, without yourself
            onData: others => {
                if (!slug || !excalidrawApi) return;

                const wasPresent = othersPresent.current;
                othersPresent.current = others.length > 0;
                if (!wasPresent && !othersPresent.current) return;

                if (wasPresent !== othersPresent.current) {
                    setIsCollaborating(othersPresent.current);
                }

                // Someone joined, so show them where you are
                if (!wasPresent) send();

                const key = JSON.stringify(others);
                if (key === lastOthers.current) return;
                lastOthers.current = key;

                const collaborators = new Map<string, Collaborator>(
                    others.map(c => [
                        c.id,
                        {
                            avatarUrl: c.avatarUrl,
                            username: c.name,
                            id: c.id,
                            pointer: { tool: "pointer", x: c.x, y: c.y },
                        },
                    ])
                );

                excalidrawApi.updateScene({ collaborators });
            },
            onError: error => {
                logger.error({ error, slug }, "Collaborator subscription failed");
            },
        }
    );

    const onPointerUpdate = useCallback(
        ({ pointer: next }: PointerUpdateData) => {
            pointer.current = next;
            if (!slug || !othersPresent.current || timer.current) return;
            timer.current = setTimeout(send, MOUSE_THROTTLE_TIME);
        },
        [slug, send]
    );

    return {
        isCollaborating,
        onPointerUpdate,
    };
};
