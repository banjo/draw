import { useGlobal } from "@/contexts/global-context";
import { Maybe } from "@banjoanton/utils";
import { useEffect } from "react";

type In = {
    slug: Maybe<string>;
};

export const useHistory = ({ slug }: In) => {
    const { excalidrawApi } = useGlobal();
    useEffect(() => {
        if (!excalidrawApi) return;
        excalidrawApi.history.clear();
    }, [slug, excalidrawApi]);
};
