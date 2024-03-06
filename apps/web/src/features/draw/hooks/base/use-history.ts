import { Maybe } from "@banjoanton/utils";
import { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import { useEffect } from "react";

type In = {
    slug: Maybe<string>;
    excalidrawApi: Maybe<ExcalidrawImperativeAPI>;
};

export const useHistory = ({ slug, excalidrawApi }: In) => {
    useEffect(() => {
        if (!excalidrawApi) return;
        excalidrawApi.history.clear();
    }, [slug, excalidrawApi]);
};
