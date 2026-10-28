import { useQueries, useQuery } from "@tanstack/react-query";
import { IconItem } from "../models/add-element-item";
import { IconSetId } from "../models/icon-sets";
import { IconService } from "../services/icon-service";

/** Iconify's results for the query, in the given sets */
export const useIconSearchQuery = (query: string, sets: IconSetId[]) => {
    const { data, isFetching } = useQuery({
        queryKey: ["icon-search", query, sets],
        queryFn: () => IconService.searchIcons(query, sets),
        enabled: query.length > 0 && sets.length > 0,
        staleTime: Infinity,
    });

    return { data: data ?? [], isFetching };
};

/** Every icon in the set, kept for as long as the page is open */
export const useIconCollectionQuery = (set: IconSetId | undefined) => {
    const { data } = useQuery({
        queryKey: ["icon-collection", set],
        queryFn: () => (set ? IconService.getCollection(set) : undefined),
        enabled: set !== undefined,
        staleTime: Infinity,
        gcTime: Infinity,
    });

    return data;
};

/** Every icon in the sets, as one list, once they've all loaded */
export const useIconCollectionsQuery = (sets: IconSetId[]) =>
    useQueries({
        queries: sets.map(set => ({
            queryKey: ["icon-collection", set],
            queryFn: () => IconService.getCollection(set),
            staleTime: Infinity,
            gcTime: Infinity,
        })),
        combine: results =>
            results.every(result => result.data)
                ? results.flatMap((result, i) =>
                      (result.data?.names ?? []).map((name): IconItem => ({
                          kind: "icon",
                          set: sets[i]!,
                          name,
                      }))
                  )
                : undefined,
    });
