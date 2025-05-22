import { LibraryItems } from "@excalidraw/excalidraw/types/types";
import { useLocalStorage } from "@uidotdev/usehooks";
import { debounce, hash } from "@banjoanton/utils";
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/auth-context";
import { useGlobal } from "@/contexts/global-context";

const KEY = "banjo-library";

export const useLibrary = () => {
    const { isAuthenticated } = useAuth();
    const { excalidrawApi } = useGlobal();
    // const [library, setLibrary] = useLocalStorage<LibraryItems>(KEY, []);

    const { data: library, refetch } = trpc.library.getLibrary.useQuery(undefined, {
        enabled: isAuthenticated,
    });

    const saveLibraryMutation = trpc.library.saveLibrary.useMutation({
        onSuccess: libraryItems => {
            if (!excalidrawApi) return;
            console.log("Saving library", libraryItems);
            excalidrawApi.updateLibrary({ libraryItems: libraryItems as any });
        },
    });

    const debouncedSetLibrary = useMemo(
        () =>
            debounce((data: LibraryItems) => {
                console.log("DEBOUNCED");
                saveLibraryMutation.mutate({
                    library: data as any,
                });
            }, 300),
        []
    );

    const onLibraryChange = (data: LibraryItems) => {
        console.log("on change");
        const newHash = hash(data);
        const oldHash = hash(library);
        console.log({ newData: data, old: library });
        console.log({ newHash, oldHash });
        // Only update if the new data differs from the fetched library to avoid infinite loops
        if (newHash === oldHash) return;
        debouncedSetLibrary(data);
    };
    return {
        onLibraryChange,
        library,
    };
};
