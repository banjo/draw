import { useGlobal } from "@/contexts/global-context";
import { SeenFeatures } from "@/features/features-intro/models/seen-features";
import { useFeaturesModalStore } from "@/features/features-intro/stores/use-features-modal-store";
import { useGlobalLoadingStore } from "@/stores/use-global-loading-store";
import { Maybe } from "@banjoanton/utils";
import { lazy, Suspense, useEffect, useRef } from "react";

// Loaded when it opens, with its fonts and illustrations
const FeaturesModal = lazy(() =>
    import("@/features/features-intro/components/features-modal").then(m => ({
        default: m.FeaturesModal,
    }))
);

type In = {
    slug: Maybe<string>;
};

/** Shows features this browser hasn't seen, once the drawing has loaded */
export const useFeaturesIntro = ({ slug }: In) => {
    const { excalidrawApi } = useGlobal();
    const isLoading = useGlobalLoadingStore(state => state.isLoading);
    const mode = useFeaturesModalStore(state => state.mode);
    const show = useFeaturesModalStore(state => state.show);
    const close = useFeaturesModalStore(state => state.close);
    const checked = useRef(false);

    useEffect(() => {
        if (checked.current || !excalidrawApi || isLoading) return;
        checked.current = true;

        if (SeenFeatures.getUnseen().length === 0) return;

        // Someone opening a shared link came for that drawing. The welcome waits until they
        // open the start page, while returning visitors get what's new anywhere.
        const isFirstVisit = SeenFeatures.getSeenIds().length === 0;
        if (isFirstVisit && slug) return;

        show("new");
    }, [excalidrawApi, isLoading, slug, show]);

    const render = () =>
        mode ? (
            <Suspense fallback={null}>
                <FeaturesModal mode={mode} onClose={close} />
            </Suspense>
        ) : null;

    return { render };
};
