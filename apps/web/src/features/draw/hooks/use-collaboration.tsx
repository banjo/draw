import { useAuth } from "@/contexts/auth-context";
import { trpc } from "@/lib/trpc";
import { Maybe, isDefined, noop, uuid } from "@banjoanton/utils";
import { LiveCollaborationTrigger } from "@excalidraw/excalidraw";
import {
    Collaborator,
    CollaboratorPointer,
    ExcalidrawImperativeAPI,
    Gesture,
} from "@excalidraw/excalidraw/types/types";
import { useDebounce, useLocalStorage } from "@uidotdev/usehooks";
import { useCallback, useEffect, useMemo, useState } from "react";
import generateName from "sillyname";

type In = {
    slug?: string;
    excalidrawApi: Maybe<ExcalidrawImperativeAPI>;
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
const ID_KEY = "banjo-collab-id";

const collaborators = new Map<string, Collaborator>();

export const useCollaboration = ({ slug, excalidrawApi }: In) => {
    const { user } = useAuth();
    const utils = trpc.useContext();

    const [localId] = useLocalStorage(ID_KEY, uuid());
    const displayName = useMemo(() => user?.displayName ?? generateName(), [user]);
    const avatarUrl = useMemo(() => user?.photoURL ?? randomAvatar(localId), [user]);

    trpc.collaboration.onChange.useSubscription(
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
                });
            },
            onError: error => {
                console.error({ error });
            },
        }
    );

    const updateCollaborator = trpc.collaboration.updateCollaborator.useMutation();
    const [isCollaborating, setIsCollaborating] = useState(false);

    const renderCollabButton = useCallback(() => {
        return (
            <LiveCollaborationTrigger
                isCollaborating={isCollaborating && Boolean(slug)}
                onSelect={noop}
            />
        );
    }, [isCollaborating, excalidrawApi]);

    const [mousePosition, setMousePosition] = useState(DEFAULT_MOUSE_POSITION);
    const debouncedMousePosition = useDebounce(mousePosition, 5);

    const onPointerUpdate = ({ pointer }: PointerUpdateData) => {
        if (!slug) return;
        setMousePosition(pointer);
    };

    useEffect(() => {
        if (!slug) return;
        updateCollaborator.mutate({
            avatarUrl,
            id: localId,
            name: displayName,
            slug,
            x: debouncedMousePosition.x,
            y: debouncedMousePosition.y,
        });
    }, [debouncedMousePosition]);

    return {
        isCollaborating,
        onPointerUpdate,
        renderCollabButton,
    };
};
