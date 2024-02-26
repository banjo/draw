import { useAuth } from "@/contexts/auth-context";
import { SaveDrawing } from "@/features/draw/hooks/use-drawing";
import { copyToClipboard } from "@/utils/clipboard";
import { Maybe } from "@banjoanton/utils";
import { MainMenu } from "@excalidraw/excalidraw";
import { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import { BrushIcon } from "lucide-react";
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
    const onShareDrawing = useCallback(async () => {
        const elements = excalidrawApi!.getSceneElementsIncludingDeleted();
        const order = elements.map(e => e.id);
        const updatedSlug = await saveDrawing(elements, order);
        copyToClipboard(`${window.location.origin}/draw/${updatedSlug}`);
        toast.success("Link copied to clipboard");

        if (updatedSlug && slug !== updatedSlug) {
            navigate(`/draw/${updatedSlug}`);
        }
    }, [excalidrawApi, slug]);

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

                {user && (
                    <MainMenu.Item
                        onSelect={toggleSidebar}
                        icon={<ResponsiveIcon Icon={BrushIcon} />}
                    >
                        Drawings
                    </MainMenu.Item>
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
