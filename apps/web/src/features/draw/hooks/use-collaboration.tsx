import { useAuth } from "@/contexts/auth-context";
import { ExcalidrawElements } from "@/features/draw/hooks/use-elements-state";
import { removeDeletedElements } from "@/features/draw/utils/element-utils";
import { trpc } from "@/lib/trpc";
import { Maybe, isDefined, isEqual, noop, uuid } from "@banjoanton/utils";
import { LiveCollaborationTrigger } from "@excalidraw/excalidraw";
import { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import {
    AppState,
    Collaborator,
    CollaboratorPointer,
    ExcalidrawImperativeAPI,
    Gesture,
} from "@excalidraw/excalidraw/types/types";
import { useDebounce, useLocalStorage } from "@uidotdev/usehooks";
import { useCallback, useEffect, useMemo, useState } from "react";
import generateName from "sillyname";
import { Board, BoardUpdateResponse, DeltaUpdateUtil, ExcalidrawSimpleElement } from "utils";

type In = {
    slug?: string;
    excalidrawApi: Maybe<ExcalidrawImperativeAPI>;
    setElements: (elements: ExcalidrawElements) => void;
    elements: ExcalidrawElements;
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

export const useCollaboration = ({ slug, excalidrawApi, setElements, elements }: In) => {
    const { user } = useAuth();
    const [localId] = useLocalStorage(ID_KEY, uuid());
    const displayName = useMemo(() => user?.displayName ?? generateName(), [user]);
    const avatarUrl = useMemo(() => user?.photoURL ?? randomAvatar(localId), [user]);

    trpc.collaboration.onBoardChange.useSubscription(
        { slug: slug ?? "", id: localId },
        {
            enabled: isDefined(slug),
            onData: update => {
                if (!slug || !excalidrawApi) return;

                if (BoardUpdateResponse.isFullBoard(update)) {
                    excalidrawApi.updateScene({
                        elements: ExcalidrawSimpleElement.toExcalidrawElements(
                            update.board.elements
                        ),
                    });
                    return;
                }

                if (update.delta.senderId === localId) return;

                const simpleElements = ExcalidrawSimpleElement.fromMany(elements);
                const currentBoard = Board.from({ elements: simpleElements });

                const updatedBoard = DeltaUpdateUtil.applyToBoard(update.delta, currentBoard);
                const updatedElements = ExcalidrawSimpleElement.toExcalidrawElements(
                    updatedBoard.elements
                );

                setElements(updatedElements);
                excalidrawApi.updateScene({
                    elements: updatedElements,
                });
            },
            onError: error => {
                console.error({ error });
            },
        }
    );

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

    const updateBoard = trpc.collaboration.updateBoard.useMutation();
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

    const onDrawingChange = async (e: readonly ExcalidrawElement[], state: AppState) => {
        const allButDeletedNewElements = removeDeletedElements(e);
        const allButDeletedOldElements = removeDeletedElements(elements);

        if (isEqual(allButDeletedNewElements, allButDeletedOldElements)) {
            return;
        }

        const updatedElements = allButDeletedNewElements.filter(newElement => {
            const oldElement = allButDeletedOldElements.find(el => el.id === newElement.id);
            if (!oldElement) return true;
            if (oldElement.version < newElement.version) return true;
            return false;
        });

        const elementsToDelete = allButDeletedOldElements
            .filter(oldElement => {
                const newElement = allButDeletedNewElements.find(el => el.id === oldElement.id);
                if (!newElement) return true;
                return false;
            })
            .map(element => ({ ...element, isDeleted: true }));

        const allElements = structuredClone(allButDeletedNewElements);
        setElements(allElements);

        if (!slug) return;

        // TODO: do not send an update one the first render, when it has fetched the board and applies it to the scene

        const currentOrder = allElements.map(e => e.id);
        const elementsToSave = [...updatedElements, ...elementsToDelete];

        console.log(elementsToSave[0]?.version);

        updateBoard.mutate({
            slug,
            deltaBoardUpdate: {
                excalidrawElements: elementsToSave,
                order: currentOrder,
                senderId: localId,
            },
        });
    };

    useEffect(() => {
        if (!slug || !isCollaborating) return;
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
        renderCollabButton,
        onDrawingChange,
    };
};
