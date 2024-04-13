import { useAuth } from "@/contexts/auth-context";
import { useGlobal } from "@/contexts/global-context";
import { SaveDrawing } from "@/features/draw/hooks/base/use-drawing";
import { ElementCreationUtil } from "@/features/draw/utils/element-creation-util";
import { FileUtil } from "@/features/draw/utils/file-util";
import { StateUtil } from "@/features/draw/utils/state-util";
import { CODE_ELEMENT_CLASS } from "@/features/selected-element-visuals/components/code-editor";
import { useError } from "@/hooks/use-error";
import { trpc } from "@/lib/trpc";
import { copyToClipboard } from "@/utils/clipboard";
import { logger } from "@/utils/logger";
import { Maybe, raise, toIsoDateString, wrapAsync } from "@banjoanton/utils";
import { MainMenu, exportToCanvas } from "@excalidraw/excalidraw";
import { BinaryFileData } from "@excalidraw/excalidraw/types/types";
import { ExcalidrawElement } from "common";
import html2canvas from "html2canvas";
import { BrushIcon, CopyIcon, FileDown, FolderIcon, PlusIcon, SaveIcon } from "lucide-react";
import { useCallback } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { Icons, ResponsiveIcon } from "ui";

type In = {
    slug: Maybe<string>;
    saveDrawing: SaveDrawing;
    toggleSidebar: () => void;
};

export const useMenu = ({ slug, saveDrawing, toggleSidebar }: In) => {
    const { excalidrawApi } = useGlobal();
    const navigate = useNavigate();
    const { signInWithGoogle, user, signOut } = useAuth();
    const { handleError } = useError();

    const utils = trpc.useContext();

    const saveDrawingToDatabase = useCallback(
        (createNewDrawing = false) => {
            if (!excalidrawApi) return;

            const elements = excalidrawApi.getSceneElementsIncludingDeleted();
            const order = elements.map(e => e.id);
            return saveDrawing(elements, order, createNewDrawing);
        },
        [excalidrawApi, saveDrawing]
    );

    const onShareDrawing = useCallback(async () => {
        if (!excalidrawApi) return;

        const updatedSlug = await saveDrawingToDatabase();
        copyToClipboard(`${window.location.origin}/draw/${updatedSlug}`);
        toast.success("Link copied to clipboard");

        if (updatedSlug && slug !== updatedSlug) {
            navigate(`/draw/${updatedSlug}`);
        }
    }, [excalidrawApi, slug]);

    const saveToCollection = async () => {
        let currentSlug = slug;
        if (!currentSlug) {
            currentSlug = await saveDrawingToDatabase();
        }

        if (!currentSlug) {
            toast.error("Error saving drawing");
            return;
        }

        const [res, error] = await wrapAsync(
            async () => await utils.client.draw.saveToCollection.mutate({ slug: currentSlug! }) // currentSlug is not undefined here
        );

        if (error) {
            await handleError(error, {
                toast: true,
                errorMessage: "Error saving drawing to collection",
            });
            return;
        }

        utils.draw.getCollection.invalidate();
        toast.success("Drawing saved to my collection!");
        navigate(`/draw/${currentSlug}`);
    };

    const copyToNewDrawing = useCallback(async () => {
        const newSlug = await saveDrawingToDatabase(true);
        if (newSlug) {
            toast.success("Drawing copied to new drawing");
            navigate(`/draw/${newSlug}`);
        }
    }, [excalidrawApi]);

    const createNewDrawing = useCallback(async () => {
        if (!excalidrawApi) return;
        const newSlug = await saveDrawing([], [], true);
        toast.success("New drawing created");
        if (newSlug) {
            navigate(`/draw/${newSlug}`);
        }
    }, [excalidrawApi]);

    const goToLocalDrawing = () => {
        // TODO: improve this, some strange logic with using local storage elements
        window.location.href = "/";
    };

    const saveToImage = async () => {
        if (!excalidrawApi) return;

        const codeHtmlElements = [
            ...document.querySelectorAll(`.${CODE_ELEMENT_CLASS}`),
        ] as HTMLElement[];

        const codeExcalidrawElements = excalidrawApi
            .getSceneElements()
            .filter(e => e.customData?.type === "codeblock");

        if (codeExcalidrawElements.length !== codeHtmlElements.length) {
            logger.error("Code elements mismatch");
        }

        type CustomElementImageData = {
            data: string;
            mimeType: string;
            element: ExcalidrawElement;
            binaryFileData: BinaryFileData;
            htmlElement: HTMLElement;
        };

        const customElements: CustomElementImageData[] = await Promise.all(
            codeHtmlElements.map(async htmlElement => {
                const canvas = await html2canvas(htmlElement, {
                    allowTaint: true,
                    logging: false,
                    backgroundColor: null,
                    scale: 3,
                });

                const mimeType = "image/png";
                const data = canvas.toDataURL(mimeType, 1);
                const elementId = htmlElement.dataset.elementId ?? raise("Element id not found");
                const element =
                    codeExcalidrawElements.find(e => e.id === elementId) ??
                    raise("Element not found");

                const binaryFileData = FileUtil.createImageFile({ data, mimeType });
                return { data, element, mimeType, binaryFileData, htmlElement };
            })
        );

        const newImageElements = customElements.map(({ element, binaryFileData }) => {
            return ElementCreationUtil.createImage({
                base: {
                    height: element.height,
                    width: element.width,
                    x: element.x,
                    y: element.y,
                },
                fileId: binaryFileData.id,
            });
        });

        const currentElements = excalidrawApi.getSceneElements();

        const state = StateUtil.updateState(excalidrawApi.getAppState(), draft => {
            draft.exportWithDarkMode = false;
            draft.exportBackground = true;
            return draft;
        });

        excalidrawApi.addFiles(customElements.map(e => e.binaryFileData));

        const canvas = await exportToCanvas({
            // @ts-ignore - wrong with local types
            elements: [...currentElements, ...newImageElements],
            files: excalidrawApi.getFiles(),
            appState: state,
            exportPadding: 5,
        });

        const fileName = `banjodraw-${toIsoDateString(new Date())}.png`;
        FileUtil.downloadImage(canvas.toDataURL("image/png"), fileName);
    };

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

                <MainMenu.Separator />

                {slug && (
                    <>
                        <MainMenu.Item
                            onSelect={goToLocalDrawing}
                            icon={<ResponsiveIcon Icon={FolderIcon} />}
                        >
                            Offline mode
                        </MainMenu.Item>

                        <MainMenu.Separator />
                    </>
                )}

                <MainMenu.Item
                    onSelect={createNewDrawing}
                    icon={<ResponsiveIcon Icon={PlusIcon} />}
                >
                    New drawing
                </MainMenu.Item>

                <MainMenu.Item
                    onSelect={copyToNewDrawing}
                    icon={<ResponsiveIcon Icon={CopyIcon} />}
                >
                    Create copy
                </MainMenu.Item>

                <MainMenu.Item
                    onSelect={onShareDrawing}
                    icon={<ResponsiveIcon Icon={Icons.link} />}
                >
                    Share drawing
                </MainMenu.Item>

                <MainMenu.Separator />

                {user && (
                    <>
                        <MainMenu.Item
                            onSelect={toggleSidebar}
                            icon={<ResponsiveIcon Icon={BrushIcon} />}
                        >
                            Collection
                        </MainMenu.Item>

                        <MainMenu.Item
                            onSelect={saveToCollection}
                            icon={<ResponsiveIcon Icon={SaveIcon} />}
                        >
                            Save to my collection
                        </MainMenu.Item>

                        <MainMenu.Separator />
                    </>
                )}

                {/* TODO: USE ImageDown WHEN IT WORKS  */}
                <MainMenu.Item onSelect={saveToImage} icon={<ResponsiveIcon Icon={FileDown} />}>
                    Export image as PNG
                </MainMenu.Item>

                <MainMenu.Separator />
                <MainMenu.DefaultItems.Help />
            </MainMenu>
        );
    };

    return {
        renderMenu,
    };
};
