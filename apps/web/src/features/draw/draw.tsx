import { useGlobal } from "@/contexts/global-context";
import { ExportModal } from "@/features/draw/components/export-modal";
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
import { useTheme } from "@/providers/theme-provider";
import { useExportModalStore } from "@/stores/use-export-modal-store";
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

    const setShowExportModal = useExportModalStore(s => s.setShowExportModal);
    const showExportModal = useExportModalStore(s => s.showExportModal);

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

    const { setTheme, theme } = useTheme();

    const handleOnChange: OnChangeCallback = (changeElements, appState, files) => {
        if (!excalidrawApi) return;

        if (theme !== appState.theme) {
            setTheme(appState.theme);
        }

        const elements = excalidrawApi.getSceneElements(); // get elements from excalidraw api, changeElements is buggy
        onDrawingChange(elements, appState);
        updateCodeBlockElements(elements, appState, files);
        handleSelectedElementVisuals(elements, appState, files);
        cleanup(elements, appState, files);
    };

    return (
        <>
            {renderAddElement()}
            {showSignInModal ? (
                <SignInModal setShow={setShowSignInModal} show={showSignInModal} />
            ) : null}
            {showExportModal ? (
                <ExportModal setShow={setShowExportModal} show={showExportModal} />
            ) : null}
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
                    initialData={{
                        // @ts-ignore - better local typings
                        elements,
                        scrollToContent: true,
                        libraryItems: library,
                        appState: { theme: theme === "light" ? "light" : "dark" },
                    }}
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
