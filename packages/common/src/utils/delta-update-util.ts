import { isDefined } from "@banjoanton/utils";
import { Board } from "../model/board";
import { BoardDeltaUpdate } from "../model/board-delta-update";

type VersionedElement = {
    id: string | number;
    version: number;
    versionNonce?: number;
};

/**
 * Whether an incoming copy of an element should replace the current one. Same rule as
 * Excalidraw: the higher version wins, and on a tie the lower versionNonce, so the server and
 * every client pick the same copy.
 */
const shouldReplace = (current: VersionedElement, incoming: VersionedElement) =>
    incoming.version > current.version ||
    (incoming.version === current.version &&
        (incoming.versionNonce ?? 0) < (current.versionNonce ?? 0));

type MergeElementsProps<T extends VersionedElement> = {
    elements: readonly T[];
    incoming: readonly T[];
    order?: readonly string[];
    /** Keep these elements as they are, e.g. the one the user is editing right now. */
    keep?: (id: string) => boolean;
};

/**
 * Merge incoming elements into the current ones. Deleted elements stay (with isDeleted), so
 * an older copy can't bring them back. With an order, elements are sorted by it, and the ones
 * it doesn't list, like elements someone else just added, are kept at the end.
 */
const mergeElements = <T extends VersionedElement>({
    elements,
    incoming,
    order,
    keep,
}: MergeElementsProps<T>) => {
    const byId = new Map(elements.map(element => [String(element.id), element]));
    const applied: T[] = [];

    for (const element of incoming) {
        const id = String(element.id);
        const current = byId.get(id);
        if (current && (keep?.(id) || !shouldReplace(current, element))) continue;

        byId.set(id, element);
        applied.push(element);
    }

    if (!order) {
        return { elements: [...byId.values()], applied };
    }

    const ordered = [...new Set(order.map(String))].filter(id => byId.has(id));
    const listed = new Set(ordered);
    const unlisted = [...byId.keys()].filter(id => !listed.has(id));
    const merged = [...ordered, ...unlisted].map(id => byId.get(id)).filter(isDefined);

    return { elements: merged, applied };
};

type ApplyToBoardProps = {
    deltaUpdate: BoardDeltaUpdate;
    board: Board;
};

const applyToBoard = ({ board, deltaUpdate }: ApplyToBoardProps): Board => {
    const { elements } = mergeElements({
        elements: board.elements,
        incoming: deltaUpdate.excalidrawElements,
        order: deltaUpdate.order,
    });

    return Board.from({ elements });
};

export const DeltaUpdateUtil = {
    applyToBoard,
    mergeElements,
    shouldReplace,
};
