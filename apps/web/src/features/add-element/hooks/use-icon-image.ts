import { useEffect, useSyncExternalStore } from "react";
import { IconSetId } from "../models/icon-sets";
import { IconImageStore } from "../services/icon-image-store";

/** The icon's image, loaded when first shown */
export const useIconImage = (set: IconSetId, name: string) => {
    const image = useSyncExternalStore(IconImageStore.subscribe, () =>
        IconImageStore.get(set, name)
    );

    useEffect(() => IconImageStore.load(set, name), [set, name]);

    return image;
};
