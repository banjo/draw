import { useAuth } from "@/contexts/auth-context";
import { useGlobal } from "@/contexts/global-context";
import { CreateDrawing } from "@/features/draw/hooks/base/use-drawing";
import { useError } from "@/hooks/use-error";
import { useLatestCallback } from "@/hooks/use-latest-callback";
import { trpc } from "@/lib/trpc";
import { authService } from "@/services/auth-service";
import { useExportModalStore } from "@/stores/use-export-modal-store";
import { useSignInModalStore } from "@/stores/use-sign-in-modal-store";
import { copyToClipboard } from "@/utils/clipboard";
import { Maybe, wrapAsync } from "@banjoanton/utils";
import { MainMenu } from "@excalidraw/excalidraw";
import { BrushIcon, CopyIcon, FileDown, FolderIcon, PlusIcon, SaveIcon } from "lucide-react";
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
    const navigate = useNavigate();

    const setShowSignInModal = useSignInModalStore(s => s.setShowSignInModal);
    const setShowExportModal = useExportModalStore(s => s.setShowExportModal);

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

    const onShareDrawing = useLatestCallback(async () => {
        if (!excalidrawApi) return;

        const updatedSlug = await createDrawingFromCanvas();
        if (!updatedSlug) return;

        copyToClipboard(`${window.location.origin}/draw/${updatedSlug}`);
        toast.success("Link copied to clipboard");

        if (slug !== updatedSlug) {
            navigate(`/draw/${updatedSlug}`);
        }
    });

    const saveToCollection = useLatestCallback(async () => {
        let currentSlug = slug;
        if (!currentSlug) {
            // TODO: fix this possible race condition bug
            currentSlug = await createDrawingFromCanvas();
        }

        if (!currentSlug) {
            toast.error("Error saving drawing");
            return;
        }

        const [_, error] = await wrapAsync(
            async () => await utils.client.draw.saveToCollection.mutate({ slug: currentSlug })
        );

        if (error) {
            await handleError(error, {
                toast: true,
                errorMessage: "Error saving drawing to collection",
            });
            return;
        }

        utils.draw.getCollection.invalidate();
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
        toast.success("New drawing created");
        if (newSlug) {
            navigate(`/draw/${newSlug}`);
        }
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
                        onSelect={onShareDrawing}
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
                            onSelect={saveToCollection}
                            icon={<ResponsiveIcon Icon={SaveIcon} />}
                        >
                            Save to my collection
                        </MainMenu.Item>

                        <MainMenu.Separator />
                    </>
                ) : null}

                <MainMenu.Item
                    onSelect={() => {
                        setShowExportModal(true);
                    }}
                    icon={<ResponsiveIcon Icon={FileDown} />}
                >
                    Export
                </MainMenu.Item>

                {/* TODO: USE ImageDown WHEN IT WORKS  */}
                {/* <MainMenu.Item onSelect={exportToPng} icon={<ResponsiveIcon Icon={FileDown} />}> */}
                {/*     Export as PNG */}
                {/* </MainMenu.Item> */}
                {/**/}
                {/* <MainMenu.Item onSelect={exportToSvg} icon={<ResponsiveIcon Icon={FileDown} />}> */}
                {/*     Export as SVG */}
                {/* </MainMenu.Item> */}

                <MainMenu.DefaultItems.Export />
                <MainMenu.Separator />
                <MainMenu.DefaultItems.ToggleTheme />
                <MainMenu.DefaultItems.Help />
            </MainMenu>
        ),
        [isAuthenticated, slug]
    );

    return {
        menu,
    };
};
