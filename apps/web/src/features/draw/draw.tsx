import { useDrawing } from "@/features/draw/hooks/base/use-drawing";
import { useElementsState } from "@/features/draw/hooks/base/use-elements-state";
import { useHistory } from "@/features/draw/hooks/base/use-history";
import { useImages } from "@/features/draw/hooks/base/use-images";
import { useKeyboard } from "@/features/draw/hooks/base/use-keyboard";
import { useLibrary } from "@/features/draw/hooks/base/use-library";
import { useCollaboration } from "@/features/draw/hooks/collaboration/use-collaboration";
import { useChangeElementDialog } from "@/features/draw/hooks/mask/use-change-element-dialog";
import { useMenu } from "@/features/draw/hooks/ui/use-menu";
import { useSidebar } from "@/features/draw/hooks/ui/use-sidebar";
import { Maybe } from "@banjoanton/utils";
import { Excalidraw } from "@excalidraw/excalidraw";
import { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import { AppState, BinaryFiles, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import { useRef, useState } from "react";

type DrawProps = {
    slug?: string;
};

export type OnChangeCallback = Maybe<
    (elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => void
>;

export const Draw = ({ slug }: DrawProps) => {
    const { elements, setElements } = useElementsState({ slug });
    const [excalidrawApi, setExcalidrawApi] = useState<Maybe<ExcalidrawImperativeAPI>>(undefined);
    const excalidrawRef = useRef(null);

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

    const { handleChangeElementDialog, renderChangeElementDialog, handleChangeElementDialogClick } =
        useChangeElementDialog({
            excalidrawApi,
        });

    const { handleKeyDown, handleKeyUp } = useKeyboard({
        excalidrawApi,
        handleChangeElementDialogClick,
    });

    const handleOnChange: OnChangeCallback = (elements, appState, files) => {
        if (!excalidrawApi) return;
        onDrawingChange(elements, appState);
        handleChangeElementDialog(elements, appState, files);
    };

    return (
        <div style={{ height: "100dvh" }} onKeyDown={handleKeyDown} onKeyUp={handleKeyUp}>
            {renderChangeElementDialog()}
            <Excalidraw
                excalidrawAPI={(api: ExcalidrawImperativeAPI) => setExcalidrawApi(api)}
                onChange={handleOnChange}
                onLibraryChange={onLibraryChange}
                isCollaborating={isCollaborating}
                onPointerUpdate={onPointerUpdate}
                handleKeyboardGlobally={false}
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
