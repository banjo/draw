import { useAuth } from "@/contexts/auth-context";
import { useGlobal } from "@/contexts/global-context";
import { CreateDrawing } from "@/features/draw/hooks/base/use-drawing";
import { useError } from "@/hooks/use-error";
import { useLatestCallback } from "@/hooks/use-latest-callback";
import { trpc } from "@/lib/trpc";
import { authService } from "@/services/auth-service";
import { useSignInModalStore } from "@/stores/use-sign-in-modal-store";
import { useFeaturesModalStore } from "@/features/features-intro/stores/use-features-modal-store";
import { useCopyToCollection } from "@/features/share/hooks/use-copy-to-collection";
import { useShareDialogStore } from "@/features/share/stores/use-share-dialog-store";
import { Maybe, wrapAsync } from "@banjoanton/utils";
import { MainMenu, useDevice } from "@excalidraw/excalidraw";
import { BrushIcon, CopyPlus, FolderIcon, PlusIcon, SaveIcon, Sparkles } from "lucide-react";
import { useMemo } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { Icons, ResponsiveIcon } from "ui";

type In = {
    slug: Maybe<string>;
    createDrawing: CreateDrawing;
    toggleSidebar: () => void;
    uploadImagesOnCanvas: () => Promise<boolean>;
};

/**
 * The account menu's items, at the end of the main menu when there's no account menu: on
 * phones, and when signed out
 */
const AccountItems = ({ toggleSidebar }: { toggleSidebar: () => void }) => {
    const { editor } = useDevice();
    const { isAuthenticated } = useAuth();
    const showFeatures = useFeaturesModalStore(s => s.show);
    const setShowSignInModal = useSignInModalStore(s => s.setShowSignInModal);
    if (isAuthenticated && !editor.isMobile) return null;

    return (
        <>
            <MainMenu.Separator />
            {isAuthenticated ? (
                <MainMenu.Item onSelect={toggleSidebar} icon={<ResponsiveIcon Icon={BrushIcon} />}>
                    My collection
                </MainMenu.Item>
            ) : null}
            <MainMenu.DefaultItems.ToggleTheme />
            <MainMenu.Item
                onSelect={() => showFeatures("all")}
                icon={<ResponsiveIcon Icon={Sparkles} />}
            >
                Features
            </MainMenu.Item>
            <MainMenu.DefaultItems.Help />
            {isAuthenticated ? (
                <>
                    <MainMenu.Separator />
                    <MainMenu.Item
                        onSelect={async () => await authService.signOut()}
                        icon={<ResponsiveIcon Icon={Icons.signOut} />}
                    >
                        Sign out
                    </MainMenu.Item>
                </>
            ) : null}
            {/* On wider screens, Sign in is at the top right */}
            {!isAuthenticated && editor.isMobile ? (
                <>
                    <MainMenu.Separator />
                    <MainMenu.Item
                        onSelect={() => setShowSignInModal(true)}
                        icon={<ResponsiveIcon Icon={Icons.arrowRight} />}
                    >
                        Sign in
                    </MainMenu.Item>
                </>
            ) : null}
        </>
    );
};

export const useMenu = ({ slug, createDrawing, toggleSidebar, uploadImagesOnCanvas }: In) => {
    const { excalidrawApi } = useGlobal();
    const navigate = useNavigate();

    const { isAuthenticated } = useAuth();
    const { handleError } = useError();

    const utils = trpc.useUtils();
    const openShareDialog = useShareDialogStore(s => s.open);
    const copyToCollection = useCopyToCollection();

    /** Create a new drawing from what's on the canvas, and return its slug. */
    const createDrawingFromCanvas = useLatestCallback(async () => {
        if (!excalidrawApi) return;

        if (!slug) {
            const isUploaded = await uploadImagesOnCanvas();
            if (!isUploaded) return;
        }

        const elements = excalidrawApi.getSceneElementsIncludingDeleted();
        const order = elements.map(e => e.id);
        return await createDrawing(elements, order);
    });

    /** Open the share window. On the start page, the drawing is saved first. */
    const shareDrawing = useLatestCallback(async () => {
        if (!excalidrawApi) return;

        const updatedSlug = slug ?? (await createDrawingFromCanvas());
        if (!updatedSlug) return;

        if (slug !== updatedSlug) {
            navigate(`/draw/${updatedSlug}`);
        }
        openShareDialog(updatedSlug);
    });

    const saveToCollection = useLatestCallback(async () => {
        const currentSlug = slug ?? (await createDrawingFromCanvas());

        // Creating it already showed the error
        if (!currentSlug) return;

        const [_, error] = await wrapAsync(
            async () => await utils.client.collection.add.mutate({ slug: currentSlug })
        );

        if (error) {
            await handleError(error, {
                toast: true,
                errorMessage: "Error saving drawing to collection",
            });
            return;
        }

        utils.collection.get.invalidate();
        toast.success("Drawing saved to my collection!");
        navigate(`/draw/${currentSlug}`);
    });

    const copyToMyCollection = useLatestCallback(async () => {
        if (slug) await copyToCollection(slug);
    });

    const createNewDrawing = useLatestCallback(async () => {
        if (!excalidrawApi) return;
        const newSlug = await createDrawing([], []);
        if (!newSlug) return;

        toast.success("New drawing created");
        navigate(`/draw/${newSlug}`);
    });

    const goToLocalDrawing = useLatestCallback(() => navigate("/"));
    const onToggleSidebar = useLatestCallback(toggleSidebar);

    // A stable element, so Excalidraw only re-renders when the menu itself changes
    const menu = useMemo(
        () => (
            <MainMenu>
                <MainMenu.Item
                    onSelect={createNewDrawing}
                    icon={<ResponsiveIcon Icon={PlusIcon} />}
                >
                    New drawing
                </MainMenu.Item>

                {slug ? (
                    <MainMenu.Item
                        onSelect={copyToMyCollection}
                        icon={<ResponsiveIcon Icon={CopyPlus} />}
                    >
                        Copy to my collection
                    </MainMenu.Item>
                ) : (
                    <MainMenu.Item
                        onSelect={shareDrawing}
                        icon={<ResponsiveIcon Icon={Icons.link} />}
                    >
                        Share drawing
                    </MainMenu.Item>
                )}

                {isAuthenticated ? (
                    <MainMenu.Item
                        onSelect={saveToCollection}
                        icon={<ResponsiveIcon Icon={SaveIcon} />}
                    >
                        Save to my collection
                    </MainMenu.Item>
                ) : null}

                <MainMenu.Separator />
                <MainMenu.DefaultItems.SaveAsImage />
                <MainMenu.DefaultItems.Export />

                {slug ? (
                    <>
                        <MainMenu.Separator />
                        <MainMenu.Item
                            onSelect={goToLocalDrawing}
                            icon={<ResponsiveIcon Icon={FolderIcon} />}
                        >
                            Offline mode
                        </MainMenu.Item>
                    </>
                ) : null}

                <AccountItems toggleSidebar={onToggleSidebar} />
            </MainMenu>
        ),
        [isAuthenticated, slug]
    );

    return {
        menu,
        shareDrawing,
    };
};
