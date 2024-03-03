import { useCollaboration } from "@/features/draw/hooks/use-collaboration";
import { useDrawing } from "@/features/draw/hooks/use-drawing";
import { useElementsState } from "@/features/draw/hooks/use-elements-state";
import { useImages } from "@/features/draw/hooks/use-images";
import { useLibrary } from "@/features/draw/hooks/use-library";
import { useMenu } from "@/features/draw/hooks/use-menu";
import { useSidebar } from "@/features/draw/hooks/use-sidebar";
import { Maybe } from "@banjoanton/utils";
import { Excalidraw } from "@excalidraw/excalidraw";
import { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import { useState } from "react";

type DrawProps = {
    slug?: string;
};

export const Draw = ({ slug }: DrawProps) => {
    const { elements, setElements, debouncedSetElements } = useElementsState({ slug });
    const [excalidrawApi, setExcalidrawApi] = useState<Maybe<ExcalidrawImperativeAPI>>(undefined);

    const { onLibraryChange, library } = useLibrary();
    const { onPointerUpdate, renderCollabButton, isCollaborating, onDrawingChange } =
        useCollaboration({
            slug,
            excalidrawApi,
            elements,
            setElements,
            debouncedSetElements,
        });

    const { saveDrawing } = useDrawing({
        excalidrawApi,
        slug,
        setElements,
        elements,
        debouncedSetElements,
    });

    const { renderSidebar, renderSidebarButton, toggleSidebar } = useSidebar({
        excalidrawApi,
        slug,
    });
    const { renderMenu } = useMenu({ slug, excalidrawApi, saveDrawing, toggleSidebar });
    useImages({ elements, excalidrawApi });

    return (
        <div style={{ height: "100dvh" }}>
            <Excalidraw
                excalidrawAPI={(api: ExcalidrawImperativeAPI) => setExcalidrawApi(api)}
                onChange={onDrawingChange}
                onLibraryChange={onLibraryChange}
                isCollaborating={isCollaborating}
                onPointerUpdate={onPointerUpdate}
                initialData={{ elements, scrollToContent: true, libraryItems: library }}
                UIOptions={{
                    dockedSidebarBreakpoint: 0,
                }}
                renderTopRightUI={() => (
                    <>
                        {renderCollabButton()}
                        {renderSidebarButton()}
                    </>
                )}
            >
                {renderMenu()}
                {renderSidebar()}
            </Excalidraw>
        </div>
    );
};
