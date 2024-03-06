import { trpc } from "@/lib/trpc";
import { Maybe, isEqual } from "@banjoanton/utils";
import { useDebounce } from "@uidotdev/usehooks";
import { BoardDeltaUpdate } from "common";
import { useCallback, useEffect, useState } from "react";

type In = {
    slug: Maybe<string>;
};

const DEBOUNCE_TIME = 3;

export const useDeltaMutation = ({ slug }: In) => {
    const updateBoardMutation = trpc.collaboration.updateBoard.useMutation();

    const [deltaUpdate, setDeltaUpdate] = useState<BoardDeltaUpdate>(() =>
        BoardDeltaUpdate.empty()
    );
    const debouncedDeltaUpdate = useDebounce(deltaUpdate, DEBOUNCE_TIME);

    const mutateDeltaUpdateWithDebounce = useCallback(
        (update: BoardDeltaUpdate) => {
            if (!slug) return;
            setDeltaUpdate(update);
        },
        [slug, updateBoardMutation]
    );

    const mutateDeltaUpdateInstantly = useCallback(
        (update: BoardDeltaUpdate) => {
            if (!slug) return;
            updateBoardMutation.mutate({
                deltaBoardUpdate: update,
                slug,
            });
        },
        [slug, updateBoardMutation]
    );

    useEffect(() => {
        if (!slug) return;
        if (isEqual(debouncedDeltaUpdate, BoardDeltaUpdate.empty())) return;

        // Update without debounce as it is already debounced
        mutateDeltaUpdateInstantly(debouncedDeltaUpdate);
    }, [debouncedDeltaUpdate, slug]);

    return {
        mutateDeltaUpdateInstantly,
        mutateDeltaUpdateWithDebounce,
    };
};
