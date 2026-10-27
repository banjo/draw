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
import { useCodeBlockElement } from "@/features/selected-element-visuals/hooks/use-code-block-element";
import { useSelectedElementVisuals } from "@/features/selected-element-visuals/hooks/use-selected-element-visuals";
import { useTheme } from "@/providers/theme-provider";
import { useSignInModalStore } from "@/stores/use-sign-in-modal-store";
import { Maybe } from "@banjoanton/utils";
import { Excalidraw, getSceneVersion } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import { ExcalidrawApi, ExcalidrawElements } from "common";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLatestCallback } from "@/hooks/use-latest-callback";
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

/** What the onChange handlers read from the app state, besides the elements */
const getRelevantAppState = (appState: AppState) => [
    appState.theme,
    appState.scrollX,
    appState.scrollY,
    appState.zoom.value,
    appState.width,
    appState.height,
    appState.offsetLeft,
    appState.offsetTop,
    appState.selectedElementIds,
    appState.selectedGroupIds,
    appState.editingGroupId,
    appState.newElement,
    appState.selectionElement,
    appState.resizingElement,
    appState.editingTextElement,
];

export const Draw = ({ slug }: DrawProps) => {
    const { initialElements, onElementsChange } = useElementsState({ slug });
    const { setExcalidrawApi, excalidrawApi } = useGlobal();

    const setShowSignInModal = useSignInModalStore(s => s.setShowSignInModal);
    const showSignInModal = useSignInModalStore(s => s.showSignInModal);

    useInit({ slug });

    const { onLibraryChange, library } = useLibrary();
    const { onPointerUpdate, collabButton, isCollaborating, onDrawingChange } = useCollaboration({
        slug,
    });

    const { createDrawing } = useDrawing();

    const { sidebar, sidebarButton, toggleSidebar, initialOpenSidebar } = useSidebar({
        slug,
    });

    const { uploadImagesOnCanvas, onElementsChange: checkImages } = useImages({ slug });

    const { menu } = useMenu({
        slug,
        createDrawing,
        toggleSidebar,
        uploadImagesOnCanvas,
    });

    useHistory({ slug });

    const {
        handleSelectedElementVisuals,
        render: renderSelectedElementVisuals,
        handleChangeElementDialogClick,
    } = useSelectedElementVisuals();

    const { codeBlocks, updateCodeBlockElements, onDoubleClickCapture } = useCodeBlockElement();
    const { render: renderAddElement } = useAddElement();

    const { handleKeyDown, handleKeyDownCapture, handleKeyUp } = useKeyboard({
        handleChangeElementDialogClick,
    });

    const { cleanup } = useCleanup();
    const { handleOnPaste } = useOnPaste();

    const { setTheme, resolvedTheme } = useTheme();

    const lastChange = useRef<{ version: number; appState: unknown[]; theme: string }>();

    const handleOnChange = useLatestCallback(
        (_changeElements: ExcalidrawElements, appState: AppState, files: BinaryFiles) => {
            if (!excalidrawApi) return;

            // Excalidraw calls onChange on every render, e.g. each mouse move. Skip it when
            // neither the elements (every change bumps a version) nor the app state we read
            // have changed.
            // @ts-ignore - better local typings
            const version = getSceneVersion(excalidrawApi.getSceneElementsIncludingDeleted());
            const relevantAppState = getRelevantAppState(appState);
            const previous = lastChange.current;
            const elementsChanged = previous?.version !== version;
            const appStateChanged =
                !previous || relevantAppState.some((value, i) => value !== previous.appState[i]);
            if (!elementsChanged && !appStateChanged) return;
            lastChange.current = { version, appState: relevantAppState, theme: appState.theme };

            // Only when the theme was toggled in Excalidraw, so "system" isn't saved as dark
            const themeToggled = previous && previous.theme !== appState.theme;
            if (themeToggled && appState.theme !== resolvedTheme) {
                setTheme(appState.theme);
            }

            const elements = excalidrawApi.getSceneElements(); // get elements from excalidraw api, changeElements is buggy
            if (elementsChanged) {
                onDrawingChange();
                onElementsChange();
                checkImages(elements);
                cleanup(elements, appState, files);
            }
            updateCodeBlockElements(elements, appState, files);
            handleSelectedElementVisuals(elements, appState, files);
        }
    );
    // With the "system" theme, follow the OS while the drawing is open
    useEffect(() => {
        if (excalidrawApi && excalidrawApi.getAppState().theme !== resolvedTheme) {
            excalidrawApi.updateScene({
                appState: { ...excalidrawApi.getAppState(), theme: resolvedTheme },
            });
        }
    }, [excalidrawApi, resolvedTheme]);

    // Excalidraw is memoised and re-renders when any prop changes identity, so everything
    // passed to it is kept stable
    const onPaste = useLatestCallback(handleOnPaste);
    const onLibraryChangeStable = useLatestCallback(onLibraryChange);
    const excalidrawAPI = useCallback(
        (api: unknown) => setExcalidrawApi(api as ExcalidrawApi),
        [setExcalidrawApi]
    );
    const renderTopRightUI = useCallback(
        () => (
            <>
                {collabButton}
                {sidebarButton}
            </>
        ),
        [collabButton, sidebarButton]
    );
    const children = useMemo(
        () => (
            <>
                {menu}
                {sidebar}
            </>
        ),
        [menu, sidebar]
    );

    return (
        <>
            {renderAddElement()}
            {showSignInModal ? (
                <SignInModal setShow={setShowSignInModal} show={showSignInModal} />
            ) : null}
            <div
                // Hidden overflow, so the code editor can't scroll the page
                style={{ height: "100dvh", overflow: "hidden" }}
                onKeyDown={handleKeyDown}
                onKeyDownCapture={handleKeyDownCapture}
                onKeyUp={handleKeyUp}
                onDoubleClickCapture={onDoubleClickCapture}
            >
                {codeBlocks}
                {renderSelectedElementVisuals()}
                <Excalidraw
                    excalidrawAPI={excalidrawAPI}
                    // @ts-ignore - better local typings
                    onChange={handleOnChange}
                    onPaste={onPaste}
                    onLibraryChange={onLibraryChangeStable}
                    isCollaborating={isCollaborating}
                    onPointerUpdate={onPointerUpdate}
                    handleKeyboardGlobally={false}
                    autoFocus
                    initialData={{
                        // @ts-ignore - better local typings
                        elements: initialElements,
                        scrollToContent: true,
                        libraryItems: library,
                        appState: {
                            theme: resolvedTheme,
                            openSidebar: initialOpenSidebar,
                        },
                    }}
                    UIOptions={{
                        dockedSidebarBreakpoint: 0,
                    }}
                    renderTopRightUI={renderTopRightUI}
                >
                    {children}
                </Excalidraw>
            </div>
        </>
    );
};
