import { useAuth } from "@/contexts/auth-context";
import { useGlobal } from "@/contexts/global-context";
import { SaveDrawing } from "@/features/draw/hooks/base/use-drawing";
import { useExport } from "@/features/draw/hooks/base/use-export";
import { useError } from "@/hooks/use-error";
import { trpc } from "@/lib/trpc";
import { authService } from "@/services/auth-service";
import { copyToClipboard } from "@/utils/clipboard";
import { Maybe, wrapAsync } from "@banjoanton/utils";
import { MainMenu } from "@excalidraw/excalidraw";
import { Env } from "common";
import { BrushIcon, CopyIcon, FileDown, FolderIcon, PlusIcon, SaveIcon } from "lucide-react";
import { useCallback } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { Icons, ResponsiveIcon } from "ui";

type In = {
    slug: Maybe<string>;
    saveDrawing: SaveDrawing;
    toggleSidebar: () => void;
};

export const useMenu = ({ slug, saveDrawing, toggleSidebar }: In) => {
    const { excalidrawApi } = useGlobal();
    const navigate = useNavigate();

    const { isAuthenticated } = useAuth();
    const { handleError } = useError();

    const utils = trpc.useUtils();

    const signOut = () => {
        authService.signOut();
    };

    const { exportToPng, exportToSvg } = useExport();

    const saveDrawingToDatabase = useCallback(
        (createNewDrawing = false) => {
            if (!excalidrawApi) return;

            const elements = excalidrawApi.getSceneElementsIncludingDeleted();
            const order = elements.map(e => e.id);
            return saveDrawing(elements, order, createNewDrawing);
        },
        [excalidrawApi, saveDrawing]
    );

    const onShareDrawing = useCallback(async () => {
        if (!excalidrawApi) return;

        const updatedSlug = await saveDrawingToDatabase();
        copyToClipboard(`${window.location.origin}/draw/${updatedSlug}`);
        toast.success("Link copied to clipboard");

        if (updatedSlug && slug !== updatedSlug) {
            navigate(`/draw/${updatedSlug}`);
        }
    }, [excalidrawApi, slug]);

    const saveToCollection = async () => {
        let currentSlug = slug;
        if (!currentSlug) {
            // TODO: fix this possible race condition bug
            currentSlug = await saveDrawingToDatabase();
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
    };

    const copyToNewDrawing = useCallback(async () => {
        const newSlug = await saveDrawingToDatabase(true);
        if (newSlug) {
            toast.success("Drawing copied to new drawing");
            navigate(`/draw/${newSlug}`);
        }
    }, [excalidrawApi]);

    const createNewDrawing = useCallback(async () => {
        if (!excalidrawApi) return;
        const newSlug = await saveDrawing([], [], true);
        toast.success("New drawing created");
        if (newSlug) {
            navigate(`/draw/${newSlug}`);
        }
    }, [excalidrawApi]);

    const goToLocalDrawing = () => {
        // TODO: improve this, some strange logic with using local storage elements
        window.location.href = "/";
    };

    const renderMenu = () => (
        <MainMenu>
            {isAuthenticated ? (
                <MainMenu.Item onSelect={signOut} icon={<ResponsiveIcon Icon={Icons.signOut} />}>
                    Sign out
                </MainMenu.Item>
            ) : (
                <MainMenu.Item
                    onSelect={() => {
                        authService.signInWithGithub();
                    }}
                    icon={<ResponsiveIcon Icon={Icons.arrowRight} />}
                >
                    Sign in
                </MainMenu.Item>
            )}

            <MainMenu.Separator />

            {slug && (
                <>
                    <MainMenu.Item
                        onSelect={goToLocalDrawing}
                        icon={<ResponsiveIcon Icon={FolderIcon} />}
                    >
                        Offline mode
                    </MainMenu.Item>

                    <MainMenu.Separator />
                </>
            )}

            <MainMenu.Item onSelect={createNewDrawing} icon={<ResponsiveIcon Icon={PlusIcon} />}>
                New drawing
            </MainMenu.Item>

            {slug && (
                <MainMenu.Item
                    onSelect={copyToNewDrawing}
                    icon={<ResponsiveIcon Icon={CopyIcon} />}
                >
                    Create copy
                </MainMenu.Item>
            )}

            {!slug && (
                <MainMenu.Item
                    onSelect={onShareDrawing}
                    icon={<ResponsiveIcon Icon={Icons.link} />}
                >
                    Share drawing
                </MainMenu.Item>
            )}

            <MainMenu.Separator />

            {isAuthenticated && (
                <>
                    <MainMenu.Item
                        onSelect={toggleSidebar}
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
            )}

            {/* TODO: USE ImageDown WHEN IT WORKS  */}
            <MainMenu.Item onSelect={exportToPng} icon={<ResponsiveIcon Icon={FileDown} />}>
                Export as PNG
            </MainMenu.Item>

            <MainMenu.Item onSelect={exportToSvg} icon={<ResponsiveIcon Icon={FileDown} />}>
                Export as SVG
            </MainMenu.Item>

            <MainMenu.DefaultItems.Export />
            <MainMenu.Separator />
            <MainMenu.DefaultItems.Help />
        </MainMenu>
    );

    return {
        renderMenu,
    };
};
