import { useAuth } from "@/contexts/auth-context";
import { trpc } from "@/lib/trpc";
import { Maybe, isDefined } from "@banjoanton/utils";
import { Collaborator, CollaboratorPointer, Gesture } from "@excalidraw/excalidraw/types/types";
import { useDebounce } from "@uidotdev/usehooks";
import { ExcalidrawApi } from "common";
import { useEffect, useMemo, useState } from "react";
import generateName from "sillyname";

type In = {
    slug?: string;
    excalidrawApi: Maybe<ExcalidrawApi>;
    localId: string;
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

const randomAvatar = (hash: string) => `https://robohash.org/${hash}.png`;

const collaborators = new Map<string, Collaborator>();

export const usePointerCollaboration = ({ slug, excalidrawApi, localId }: In) => {
    const { user } = useAuth();
    const displayName = useMemo(() => user?.displayName ?? generateName(), [user]);
    const avatarUrl = useMemo(() => user?.photoURL ?? randomAvatar(localId), [user]);

    trpc.collaboration.onCollaboratorChange.useSubscription(
        { slug: slug ?? "", id: localId },
        {
            enabled: isDefined(slug),
            onData: externalCollaborators => {
                if (!slug || !excalidrawApi) return;

                if (externalCollaborators.length <= 1 && !isCollaborating) {
                    return;
                }

                if (externalCollaborators.length <= 1) {
                    setIsCollaborating(false);
                    collaborators.clear();
                    excalidrawApi.updateScene({
                        collaborators,
                    });
                    return;
                }

                setIsCollaborating(true);

                const filtered = externalCollaborators.filter(c => c.id !== localId);
                collaborators.clear();
                filtered.forEach(c => {
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
        }
    );

    const updateCollaborator = trpc.collaboration.updateCollaborator.useMutation();
    const [isCollaborating, setIsCollaborating] = useState(false);

    const [mousePosition, setMousePosition] = useState(DEFAULT_MOUSE_POSITION);
    const debouncedMousePosition = useDebounce(mousePosition, 5);

    const onPointerUpdate = ({ pointer }: PointerUpdateData) => {
        if (!slug) return;
        setMousePosition(pointer);
    };

    useEffect(() => {
        if (!slug) return;
        updateCollaborator.mutate({
            collaborator: {
                avatarUrl,
                id: localId,
                name: displayName,
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
