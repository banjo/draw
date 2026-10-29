import { Placement } from "@/features/add-element/hooks/use-insert-element";
import { Maybe } from "@banjoanton/utils";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LinkLook } from "../models/link-card-render";

/** A new card, added at the placement, or a card whose link is being changed */
export type LinkCardTarget =
    { kind: "insert"; placement: Placement } | { kind: "edit"; id: string };

type LinkCardStore = {
    target: Maybe<LinkCardTarget>;
    /** The card selected on its own, for its menu */
    selected: Maybe<{ id: string; look: LinkLook; url: string }>;
    /** The look the last card was added with, kept between visits */
    look: LinkLook;
    open: (target: LinkCardTarget) => void;
    close: () => void;
    setSelected: (selected: LinkCardStore["selected"]) => void;
    setLook: (look: LinkLook) => void;
};

export const useLinkCardStore = create<LinkCardStore>()(
    persist(
        set => ({
            target: undefined,
            selected: undefined,
            look: "compact",
            open: target => set({ target }),
            close: () => set({ target: undefined }),
            setSelected: selected => set({ selected }),
            setLook: look => set({ look }),
        }),
        { name: "banjo-link-card", partialize: ({ look }) => ({ look }) }
    )
);
