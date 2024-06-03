import { useGlobal } from "@/contexts/global-context";
import { useContextMenu } from "@/features/draw/hooks/base/use-context-menu";
import { useDrawing } from "@/features/draw/hooks/base/use-drawing";
import { useElementsState } from "@/features/draw/hooks/base/use-elements-state";
import { useHelpMenu } from "@/features/draw/hooks/base/use-help-menu";
import { useHistory } from "@/features/draw/hooks/base/use-history";
import { useImages } from "@/features/draw/hooks/base/use-images";
import { useInit } from "@/features/draw/hooks/base/use-init";
import { useKeyboard } from "@/features/draw/hooks/base/use-keyboard";
import { useLibrary } from "@/features/draw/hooks/base/use-library";
import { useCollaboration } from "@/features/draw/hooks/collaboration/use-collaboration";
import { useMenu } from "@/features/draw/hooks/ui/use-menu";
import { useSidebar } from "@/features/draw/hooks/ui/use-sidebar";
import { useCodeBlockElement } from "@/features/selected-element-visuals/hooks/use-code-block-element";
import { useSelectedElementVisuals } from "@/features/selected-element-visuals/hooks/use-selected-element-visuals";
import { Maybe, isEmpty, sum } from "@banjoanton/utils";
import { Excalidraw } from "@excalidraw/excalidraw";
import { AppState, BinaryFiles } from "@excalidraw/excalidraw/types/types";
import { CustomData, ExcalidrawApi, ExcalidrawElements } from "common";
import { CustomDataUtil } from "./utils/custom-data-util";
import { UpdateElementUtil } from "./utils/update-element-util";
import { SPACING, TEXT_HEIGHT } from "./utils/element-creation-util";
import { useCleanup } from "./hooks/utils/use-cleanup";

type DrawProps = {
    slug?: string;
};

export type OnChangeCallback = Maybe<
    (elements: ExcalidrawElements, appState: AppState, files: BinaryFiles) => void
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

    const { render: renderCodeBlocks, updateCodeBlockElements } = useCodeBlockElement();

    const { handleKeyDown, handleKeyUp } = useKeyboard({
        handleChangeElementDialogClick,
    });

    const { onContextMenu } = useContextMenu();

    useHelpMenu();
    const { cleanup } = useCleanup();

    const handleOnChange: OnChangeCallback = (changeElements, appState, files) => {
        if (!excalidrawApi) return;
        const elements = excalidrawApi.getSceneElements(); // get elements from excalidraw api, changeElements is buggy
        onDrawingChange(elements, appState);
        updateCodeBlockElements(elements, appState, files);
        handleSelectedElementVisuals(elements, appState, files);
        cleanup(elements, appState, files);
    };

    return (
        <div
            style={{ height: "100dvh" }}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onContextMenu={onContextMenu}
        >
            {renderCodeBlocks()}
            {renderSelectedElementVisuals()}
            <Excalidraw
                excalidrawAPI={api => setExcalidrawApi(api as ExcalidrawApi)}
                // @ts-ignore - better local typings
                onChange={handleOnChange}
                onLibraryChange={onLibraryChange}
                isCollaborating={isCollaborating}
                onPointerUpdate={onPointerUpdate}
                handleKeyboardGlobally={false}
                autoFocus={true}
                // @ts-ignore - better local typings
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
