import { useDrawing } from "@/features/draw/hooks/base/use-drawing";
import { useElementsState } from "@/features/draw/hooks/base/use-elements-state";
import { useHistory } from "@/features/draw/hooks/base/use-history";
import { useImages } from "@/features/draw/hooks/base/use-images";
import { useKeyboard } from "@/features/draw/hooks/base/use-keyboard";
import { useLibrary } from "@/features/draw/hooks/base/use-library";
import { useCollaboration } from "@/features/draw/hooks/collaboration/use-collaboration";
import { useMenu } from "@/features/draw/hooks/ui/use-menu";
import { useSidebar } from "@/features/draw/hooks/ui/use-sidebar";
import { Maybe } from "@banjoanton/utils";
import { Excalidraw } from "@excalidraw/excalidraw";
import { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import { useState } from "react";

type DrawProps = {
    slug?: string;
};

export const Draw = ({ slug }: DrawProps) => {
    const { elements, setElements } = useElementsState({ slug });
    const [excalidrawApi, setExcalidrawApi] = useState<Maybe<ExcalidrawImperativeAPI>>(undefined);

    const { onLibraryChange, library } = useLibrary();
    const { onPointerUpdate, renderCollabButton, isCollaborating, onDrawingChange } =
        useCollaboration({
            slug,
            excalidrawApi,
            elements,
            setElements,
        });

    const { saveDrawing } = useDrawing({
        slug,
    });

    const { renderSidebar, renderSidebarButton, toggleSidebar } = useSidebar({
        excalidrawApi,
        slug,
    });
    const { renderMenu } = useMenu({
        slug,
        excalidrawApi,
        saveDrawing,
        toggleSidebar,
    });

    useImages({ elements, excalidrawApi });
    useHistory({ slug, excalidrawApi });

    const { handleKeyDown, handleKeyUp } = useKeyboard({ excalidrawApi });

    return (
        <div style={{ height: "100dvh" }} onKeyDown={handleKeyDown} onKeyUp={handleKeyUp}>
            <Excalidraw
                excalidrawAPI={(api: ExcalidrawImperativeAPI) => setExcalidrawApi(api)}
                onChange={onDrawingChange}
                onLibraryChange={onLibraryChange}
                isCollaborating={isCollaborating}
                onPointerUpdate={onPointerUpdate}
                handleKeyboardGlobally={true}
                autoFocus={true}
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
