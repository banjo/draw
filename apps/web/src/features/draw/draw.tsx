import { useGlobal } from "@/contexts/global-context";
import { useContextMenu } from "@/features/draw/hooks/base/use-context-menu";
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
import { useCodeBlockElement } from "@/features/selected-element-visuals/hooks/use-code-block-element";
import { useSelectedElementVisuals } from "@/features/selected-element-visuals/hooks/use-selected-element-visuals";
import { useSignInModalStore } from "@/stores/use-sign-in-modal-store";
import { Maybe } from "@banjoanton/utils";
import { Excalidraw } from "@excalidraw/excalidraw";
import { AppState, BinaryFiles } from "@excalidraw/excalidraw/types/types";
import { ExcalidrawApi, ExcalidrawElements } from "common";
import { useAddElement } from "../add-element/hooks/use-add-element";
import { SignInModal } from "./components/sign-in-modal";
import { useCleanup } from "./hooks/utils/use-cleanup";
import { useOnPaste } from "./hooks/utils/use-on-paste";

type DrawProps = {
    slug?: string;
};

export type OnChangeCallback = Maybe<
    (elements: ExcalidrawElements, appState: AppState, files: BinaryFiles) => void
>;

export const Draw = ({ slug }: DrawProps) => {
    const { elements, setElements } = useElementsState({ slug });
    const { setExcalidrawApi, excalidrawApi } = useGlobal();

    const setShowSignInModal = useSignInModalStore(s => s.setShowSignInModal);
    const showSignInModal = useSignInModalStore(s => s.showSignInModal);

    useInit({ slug });

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

    useImages({ elements, slug });
    useHistory({ slug });

    const {
        handleSelectedElementVisuals,
        render: renderSelectedElementVisuals,
        handleChangeElementDialogClick,
    } = useSelectedElementVisuals();

    const { render: renderCodeBlocks, updateCodeBlockElements } = useCodeBlockElement();
    const { render: renderAddElement } = useAddElement();

    const { handleKeyDown, handleKeyUp } = useKeyboard({
        handleChangeElementDialogClick,
    });

    const { onContextMenu } = useContextMenu();

    const { cleanup } = useCleanup();
    const { handleOnPaste } = useOnPaste();

    const handleOnChange: OnChangeCallback = (changeElements, appState, files) => {
        if (!excalidrawApi) return;
        const elements = excalidrawApi.getSceneElements(); // get elements from excalidraw api, changeElements is buggy
        onDrawingChange(elements, appState);
        updateCodeBlockElements(elements, appState, files);
        handleSelectedElementVisuals(elements, appState, files);
        cleanup(elements, appState, files);
    };

    return (
        <>
            {renderAddElement()}
            <SignInModal setShow={setShowSignInModal} show={showSignInModal} />
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
                    onPaste={handleOnPaste}
                    onLibraryChange={onLibraryChange}
                    isCollaborating={isCollaborating}
                    onPointerUpdate={onPointerUpdate}
                    handleKeyboardGlobally={false}
                    autoFocus
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
        </>
    );
};
