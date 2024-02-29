import { LibraryItems } from "@excalidraw/excalidraw/types/types";
import { useLocalStorage } from "react-use";

const KEY = "banjo-library";

export const useLibrary = () => {
    const [library, setLibrary] = useLocalStorage<LibraryItems>(KEY, []);

    const onLibraryChange = (data: LibraryItems) => {
        setLibrary(data);
    };
    return {
        onLibraryChange,
        library,
    };
};
