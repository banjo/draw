import { Icons } from "@/components/shared/icons";
import { ResponsiveIcon } from "@/components/shared/responsive-icon";
import { SaveDrawing } from "@/features/draw/hooks/use-drawing";
import { copyToClipboard } from "@/utils/clipboard";
import { Maybe } from "@banjoanton/utils";
import { MainMenu } from "@excalidraw/excalidraw";
import { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import { useCallback } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

type In = {
    excalidrawApi: Maybe<ExcalidrawImperativeAPI>;
    slug: Maybe<string>;
    saveDrawing: SaveDrawing;
};

export const useMenu = ({ excalidrawApi, slug, saveDrawing }: In) => {
    const navigate = useNavigate();
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
