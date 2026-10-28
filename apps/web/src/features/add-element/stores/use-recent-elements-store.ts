import { create } from "zustand";
import { persist } from "zustand/middleware";

const MAX_RECENTS = 30;

type RecentElementsStore = {
    /** Item keys, the latest first */
    recents: string[];
    addRecent: (key: string) => void;
};

/** What was added from the palette lately, kept between visits */
export const useRecentElementsStore = create<RecentElementsStore>()(
    persist(
        set => ({
            recents: [],
            addRecent: key =>
                set(state => ({
                    recents: [key, ...state.recents.filter(recent => recent !== key)].slice(
                        0,
                        MAX_RECENTS
                    ),
                })),
        }),
        { name: "banjo-recent-elements" }
    )
);
