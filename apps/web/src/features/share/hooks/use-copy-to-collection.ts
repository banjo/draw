import { useAuth } from "@/contexts/auth-context";
import { useCollectionActions } from "@/features/collection/hooks/use-collection";
import { useLatestCallback } from "@/hooks/use-latest-callback";
import { useSignInModalStore } from "@/stores/use-sign-in-modal-store";

/** Copy a drawing to your collection, or ask you to sign in first, as the copy is yours */
export const useCopyToCollection = () => {
    const { isAuthenticated } = useAuth();
    const { copyDrawing } = useCollectionActions();
    const setShowSignInModal = useSignInModalStore(s => s.setShowSignInModal);

    return useLatestCallback(async (slug: string) => {
        if (!isAuthenticated) {
            setShowSignInModal(true);
            return;
        }
        await copyDrawing(slug);
    });
};
