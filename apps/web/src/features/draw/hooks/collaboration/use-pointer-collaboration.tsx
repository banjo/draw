import { trpc } from "@/lib/trpc";
import { isDefined, Maybe } from "@banjoanton/utils";
import { Collaborator, CollaboratorPointer, Gesture } from "@excalidraw/excalidraw/types/types";
import { useThrottle } from "@uidotdev/usehooks";
import { ExcalidrawApi } from "common";
import { useEffect, useMemo, useState } from "react";
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

const collaborators = new Map<string, Collaborator>();
const MOUSE_THROTTLE_TIME = 30;

export const usePointerCollaboration = ({ slug, excalidrawApi }: In) => {
    // Shown when not signed in. Signed-in users get their name from the server.
    const anonymousName = useMemo(() => generateName(), []);
    const [isCollaborating, setIsCollaborating] = useState(false);

    const input = { slug: slug ?? "" };
    trpc.collaboration.onCollaboratorChange.useSubscription(input, {
        enabled: isDefined(slug),
        // Everyone else on the drawing, without yourself
        onData: otherCollaborators => {
            if (!slug || !excalidrawApi) return;

            if (otherCollaborators.length === 0 && !isCollaborating) {
                return;
            }

            if (otherCollaborators.length === 0) {
                setIsCollaborating(false);
                collaborators.clear();
                excalidrawApi.updateScene({
                    collaborators,
                });
                return;
            }

            setIsCollaborating(true);

            collaborators.clear();
            otherCollaborators.forEach(c => {
                collaborators.set(c.id, {
                    avatarUrl: c.avatarUrl,
                    username: c.name,
                    id: c.id,
                    pointer: {
                        tool: "pointer",
                        x: c.x,
                        y: c.y,
                    },
                });
            });

            excalidrawApi.updateScene({
                collaborators,
                elements: excalidrawApi.getSceneElements(),
            });
        },
        onError: error => {
            console.error({ error });
        },
    });

    const updateCollaborator = trpc.collaboration.updateCollaborator.useMutation();

    const [mousePosition, setMousePosition] = useState(DEFAULT_MOUSE_POSITION);
    const debouncedMousePosition = useThrottle(mousePosition, MOUSE_THROTTLE_TIME);

    const onPointerUpdate = ({ pointer }: PointerUpdateData) => {
        if (!slug) return;
        setMousePosition(pointer);
    };

    useEffect(() => {
        if (!slug) return;

        updateCollaborator.mutate({
            collaborator: {
                name: anonymousName,
                x: debouncedMousePosition.x,
                y: debouncedMousePosition.y,
            },
            slug,
        });
    }, [debouncedMousePosition, slug]);

    return {
        isCollaborating,
        onPointerUpdate,
    };
};
