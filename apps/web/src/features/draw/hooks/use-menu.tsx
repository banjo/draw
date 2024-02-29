import { useAuth } from "@/contexts/auth-context";
import { SaveDrawing } from "@/features/draw/hooks/use-drawing";
import { trpc } from "@/lib/trpc";
import { copyToClipboard } from "@/utils/clipboard";
import { Maybe } from "@banjoanton/utils";
import { MainMenu } from "@excalidraw/excalidraw";
import { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import { BrushIcon, SaveIcon } from "lucide-react";
import { useCallback } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { Icons, ResponsiveIcon } from "ui";

type In = {
    excalidrawApi: Maybe<ExcalidrawImperativeAPI>;
    slug: Maybe<string>;
    saveDrawing: SaveDrawing;
    toggleSidebar: () => void;
};

export const useMenu = ({ excalidrawApi, slug, saveDrawing, toggleSidebar }: In) => {
    const navigate = useNavigate();
    const { signInWithGoogle, user, signOut } = useAuth();

    const utils = trpc.useContext();

    const saveDrawingToDatabase = useCallback(() => {
        if (!excalidrawApi) return;

        const elements = excalidrawApi.getSceneElementsIncludingDeleted();
        const order = elements.map(e => e.id);
        return saveDrawing(elements, order);
    }, [excalidrawApi, saveDrawing]);

    const onShareDrawing = useCallback(async () => {
        if (!excalidrawApi) return;

        const updatedSlug = await saveDrawingToDatabase();
        copyToClipboard(`${window.location.origin}/draw/${updatedSlug}`);
        toast.success("Link copied to clipboard");

        if (updatedSlug && slug !== updatedSlug) {
            navigate(`/draw/${updatedSlug}`);
        }
    }, [excalidrawApi, slug]);

    const saveToCollection = useCallback(async () => {
        let currentSlug = slug;
        if (!currentSlug) {
            currentSlug = await saveDrawingToDatabase();

            if (!currentSlug) {
                toast.error("Error saving drawing");
                return;
            }
        }

        const res = await utils.client.draw.saveToCollection.mutate({ slug: currentSlug });

        if (!res.success) {
            toast.error(res.message);
            return;
        }

        utils.draw.getCollection.invalidate();
        toast.success("Drawing saved to my collection!");
        navigate(`/draw/${currentSlug}`);
    }, [slug, excalidrawApi]);

    const renderMenu = () => {
        return (
            <MainMenu>
                {user ? (
                    <MainMenu.Item
                        onSelect={signOut}
                        icon={<ResponsiveIcon Icon={Icons.signOut} />}
                    >
                        Sign out
                    </MainMenu.Item>
                ) : (
                    <MainMenu.Item
                        onSelect={signInWithGoogle}
                        icon={<ResponsiveIcon Icon={Icons.arrowRight} />}
                    >
                        Sign in
                    </MainMenu.Item>
                )}

                <MainMenu.Separator />

                {user && (
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

                <MainMenu.Item
                    onSelect={onShareDrawing}
                    icon={<ResponsiveIcon Icon={Icons.link} />}
                >
                    Share drawing
                </MainMenu.Item>

                <MainMenu.DefaultItems.SaveAsImage />
                <MainMenu.DefaultItems.Export />
                <MainMenu.Separator />
                <MainMenu.DefaultItems.Help />
            </MainMenu>
        );
    };

    return {
        renderMenu,
    };
};
