import { useGlobal } from "@/contexts/global-context";
import { useDrawing } from "@/features/draw/hooks/base/use-drawing";
import { useElementsState } from "@/features/draw/hooks/base/use-elements-state";
import { useHistory } from "@/features/draw/hooks/base/use-history";
import { useImages } from "@/features/draw/hooks/base/use-images";
import { useInit } from "@/features/draw/hooks/base/use-init";
import { useKeyboard } from "@/features/draw/hooks/base/use-keyboard";
import { useLibrary } from "@/features/draw/hooks/base/use-library";
import { useCollaboration } from "@/features/draw/hooks/collaboration/use-collaboration";
import { useMenu } from "@/features/draw/hooks/ui/use-menu";
import { useSidebar } from "@/features/draw/hooks/ui/use-sidebar";
import { useSelectedElementVisuals } from "@/features/selected-element-visuals/hooks/use-selected-element-visuals";
import { Maybe } from "@banjoanton/utils";
import { Excalidraw } from "@excalidraw/excalidraw";
import { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import { AppState, BinaryFiles, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";

type DrawProps = {
    slug?: string;
};

export type OnChangeCallback = Maybe<
    (elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => void
>;

export const Draw = ({ slug }: DrawProps) => {
    const { elements, setElements } = useElementsState({ slug });
    const { setExcalidrawApi, excalidrawApi } = useGlobal();

    useInit();

    const { onLibraryChange, library } = useLibrary();
    const { onPointerUpdate, renderCollabButton, isCollaborating, onDrawingChange } =
        useCollaboration({
            slug,
            elements,
            setElements,
        });

    const { saveDrawing } = useDrawing({
        slug,
    });

    const { renderSidebar, renderSidebarButton, toggleSidebar } = useSidebar({
        slug,
    });

    const { renderMenu } = useMenu({
        slug,
        saveDrawing,
        toggleSidebar,
    });

    useImages({ elements });
    useHistory({ slug });

    const {
        handleSelectedElementVisuals,
        render: renderSelectedElementVisuals,
        handleChangeElementDialogClick,
    } = useSelectedElementVisuals();

    const { handleKeyDown, handleKeyUp } = useKeyboard({
        handleChangeElementDialogClick,
    });

    const handleOnChange: OnChangeCallback = (elements, appState, files) => {
        if (!excalidrawApi) return;
        onDrawingChange(elements, appState);
        handleSelectedElementVisuals(elements, appState, files);
    };

    return (
        <div style={{ height: "100dvh" }} onKeyDown={handleKeyDown} onKeyUp={handleKeyUp}>
            {renderSelectedElementVisuals()}
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
