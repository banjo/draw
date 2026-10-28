import { useAuth } from "@/contexts/auth-context";
import { useGlobal } from "@/contexts/global-context";
import { CreateDrawing } from "@/features/draw/hooks/base/use-drawing";
import { useError } from "@/hooks/use-error";
import { useLatestCallback } from "@/hooks/use-latest-callback";
import { trpc } from "@/lib/trpc";
import { authService } from "@/services/auth-service";
import { useSignInModalStore } from "@/stores/use-sign-in-modal-store";
import { usePaletteStore } from "@/features/collection/stores/use-palette-store";
import { useFeaturesModalStore } from "@/features/features-intro/stores/use-features-modal-store";
import { copyToClipboard } from "@/utils/clipboard";
import { formatShortcut } from "@/utils/platform";
import { Maybe, wrapAsync } from "@banjoanton/utils";
import { MainMenu } from "@excalidraw/excalidraw";
import {
    BrushIcon,
    CopyIcon,
    FolderIcon,
    PlusIcon,
    SaveIcon,
    SearchIcon,
    Sparkles,
} from "lucide-react";
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

export const useMenu = ({ slug, createDrawing, toggleSidebar, uploadImagesOnCanvas }: In) => {
    const { excalidrawApi } = useGlobal();
    const showFeatures = useFeaturesModalStore(s => s.show);
    const openPalette = usePaletteStore(s => s.setIsOpen);
    const navigate = useNavigate();

    const setShowSignInModal = useSignInModalStore(s => s.setShowSignInModal);

    const { isAuthenticated } = useAuth();
    const { handleError } = useError();

    const utils = trpc.useUtils();

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

    /** Copy the drawing's link. On the start page, it's saved as a new drawing first. */
    const shareDrawing = useLatestCallback(async () => {
        if (!excalidrawApi) return;

        const updatedSlug = slug ?? (await createDrawingFromCanvas());
        if (!updatedSlug) return;

        // Not awaited: a clipboard write can wait for focus, and shouldn't hold up the drawing
        const link = `${window.location.origin}/draw/${updatedSlug}`;
        void copyToClipboard(link).then(copied =>
            copied
                ? toast.success("Link copied to clipboard")
                : toast.error("Could not copy the link, copy it from the address bar")
        );

        if (slug !== updatedSlug) {
            navigate(`/draw/${updatedSlug}`);
        }
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

    const copyToNewDrawing = useLatestCallback(async () => {
        const newSlug = await createDrawingFromCanvas();
        if (newSlug) {
            toast.success("Drawing copied to new drawing");
            navigate(`/draw/${newSlug}`);
        }
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
                {isAuthenticated ? (
                    <MainMenu.Item
                        onSelect={async () => await authService.signOut()}
                        icon={<ResponsiveIcon Icon={Icons.signOut} />}
                    >
                        Sign out
                    </MainMenu.Item>
                ) : (
                    <MainMenu.Item
                        onSelect={() => {
                            setShowSignInModal(true);
                        }}
                        icon={<ResponsiveIcon Icon={Icons.arrowRight} />}
                    >
                        Sign in
                    </MainMenu.Item>
                )}

                <MainMenu.Separator />

                {slug ? (
                    <>
                        <MainMenu.Item
                            onSelect={goToLocalDrawing}
                            icon={<ResponsiveIcon Icon={FolderIcon} />}
                        >
                            Offline mode
                        </MainMenu.Item>

                        <MainMenu.Separator />
                    </>
                ) : null}

                <MainMenu.Item
                    onSelect={createNewDrawing}
                    icon={<ResponsiveIcon Icon={PlusIcon} />}
                >
                    New drawing
                </MainMenu.Item>

                {slug ? (
                    <MainMenu.Item
                        onSelect={copyToNewDrawing}
                        icon={<ResponsiveIcon Icon={CopyIcon} />}
                    >
                        Create copy
                    </MainMenu.Item>
                ) : null}

                {!slug && (
                    <MainMenu.Item
                        onSelect={shareDrawing}
                        icon={<ResponsiveIcon Icon={Icons.link} />}
                    >
                        Share drawing
                    </MainMenu.Item>
                )}

                <MainMenu.Separator />

                {isAuthenticated ? (
                    <>
                        <MainMenu.Item
                            onSelect={onToggleSidebar}
                            icon={<ResponsiveIcon Icon={BrushIcon} />}
                        >
                            Collection
                        </MainMenu.Item>

                        <MainMenu.Item
                            onSelect={() => openPalette(true)}
                            icon={<ResponsiveIcon Icon={SearchIcon} />}
                            shortcut={formatShortcut("O")}
                        >
                            Find a drawing
                        </MainMenu.Item>

                        <MainMenu.Item
                            onSelect={saveToCollection}
                            icon={<ResponsiveIcon Icon={SaveIcon} />}
                        >
                            Save to my collection
                        </MainMenu.Item>

                        <MainMenu.Separator />
                    </>
                ) : null}

                <MainMenu.DefaultItems.SaveAsImage />
                <MainMenu.DefaultItems.Export />
                <MainMenu.Separator />
                <MainMenu.DefaultItems.ToggleTheme />
                <MainMenu.Item
                    onSelect={() => showFeatures("all")}
                    icon={<ResponsiveIcon Icon={Sparkles} />}
                >
                    Features
                </MainMenu.Item>
                <MainMenu.DefaultItems.Help />
            </MainMenu>
        ),
        [isAuthenticated, slug]
    );

    return {
        menu,
        shareDrawing,
    };
};
