import { Icons } from "@/components/shared/icons";
import { ResponsiveIcon } from "@/components/shared/responsive-icon";
import { client } from "@/lib/hc";
import { debounce, isEqual } from "@banjoanton/utils";
import { Excalidraw, MainMenu } from "@excalidraw/excalidraw";
import {
    ExcalidrawElement,
    ExcalidrawImageElement,
} from "@excalidraw/excalidraw/types/element/types";
import { BinaryFileData, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useLocalStorage } from "react-use";
import { v4 as uuidv4 } from "uuid";

type DrawProps = {
    slug?: string;
};

const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
};

const removeDeletedElements = (elements: readonly ExcalidrawElement[]) => {
    return elements.filter(element => !element.isDeleted);
};

export const Draw = ({ slug }: DrawProps) => {
    const navigate = useNavigate();
    const localStorageKey = `drawing-${slug ?? "base"}`;

    const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);

    const [localStorageElements, setLocalStorageElements, remove] = useLocalStorage<
        readonly ExcalidrawElement[]
    >(localStorageKey, []);

    const [elements, setElements] = useState<readonly ExcalidrawElement[]>(() => {
        if (slug) return [];

        return localStorageElements ?? [];
    });

    useEffect(() => {
        if (slug) return;
        setLocalStorageElements(elements);
    }, [elements]);

    const debouncedSetElements = useMemo(() => {
        return debounce((updatedElements: readonly ExcalidrawElement[]) => {
            setElements([...updatedElements]);
        }, 300);
    }, []);

    const [isLoading, setIsLoading] = useState(false);
    const [uploadedImages, setUploadedImages] = useState<string[]>([]);

    const [isPointerDown, setIsPointerDown] = useState(false);
    const isPointerDownRef = useRef(isPointerDown);

    // Sync the ref with the state value for setInterval to work properly
    useEffect(() => {
        isPointerDownRef.current = isPointerDown;
    }, [isPointerDown]);

    const [isSaving, setIsSaving] = useState(false);
    const isSavingRef = useRef(isSaving);

    // Sync the ref with the state value for setInterval to work properly
    useEffect(() => {
        isSavingRef.current = isSaving;
    }, [isSaving]);

    const save = async (e: readonly ExcalidrawElement[]) => {
        const currentSlug = slug ?? uuidv4();

        setIsSaving(true);
        const res = await client.draw.$post({
            json: {
                elements: e as any,
                slug: currentSlug,
            },
        });

        const data = await res.json();
        setIsSaving(false);

        if (!data.success) {
            return;
        }

        return currentSlug;
    };

    const debouncedSave = useMemo(
        () =>
            debounce(async (elements: readonly ExcalidrawElement[]) => {
                if (!slug) return;
                console.log("saving");
                await save(elements);
            }, 1000),
        []
    );

    const fetchImages = async (ids: string[]) => {
        if (!excalidrawAPI) return;

        const res = await client.images.get.$post({
            json: {
                imageIds: ids,
            },
        });

        const json = await res.json();

        if (!json.success) {
            toast.error("Failed to fetch images");
            return;
        }

        const images = json.data;

        const files: BinaryFileData[] = images.map(image => ({
            id: image.imageId as any,
            dataURL: image.data as any,
            mimeType: image.mimeType as any,
            created: new Date().getMilliseconds(),
        }));

        excalidrawAPI.addFiles(files);
    };

    const fetchDrawing = async (slug: string) => {
        const res = await client.draw[":slug"].$get({
            param: {
                slug,
            },
        });
        const json = await res.json();

        if (!json.success) {
            navigate("/");
            return;
        }

        if (!json.success) {
            navigate("/");
            return;
        }

        // @ts-ignore
        return json.data as unknown as ExcalidrawElement[];
    };

    // const fetchDrawingData = async () => {
    //     if (!excalidrawAPI || !slug) return;
    //     if (isPointerDownRef.current || isSavingRef.current) return;

    //     const latestDrawing = await fetchDrawing(slug);
    //     if (!latestDrawing) return;

    //     if (isEqual(latestDrawing, elements)) {
    //         return;
    //     }

    //     const updatedLocalElements = elements?.map(element => {
    //         const latestElement = latestDrawing.find(e => e.id === element.id);
    //         if (!latestElement) return element;

    //         if (latestElement.version > element.version) {
    //             return latestElement;
    //         }

    //         return element;
    //     });

    //     const missedElements = latestDrawing.filter(
    //         element => !updatedLocalElements?.some(e => e.id === element.id)
    //     );

    //     const mergedElements = [...(updatedLocalElements ?? []), ...missedElements];

    //     excalidrawAPI.updateScene({
    //         elements: mergedElements,
    //     });
    //     setElements(mergedElements);
    // };

    // useEffect(() => {
    //     const interval = setInterval(fetchDrawingData, toMilliseconds({ seconds: 15 }));

    //     return () => {
    //         clearInterval(interval);
    //     };
    // }, [excalidrawAPI]);

    // update isFirstRun on slug change
    useEffect(() => {
        firstRun.current = true;
    }, [slug]);

    // get images on load
    useEffect(() => {
        if (!elements || !excalidrawAPI) return;

        const images = elements.filter(
            element => element.type === "image" && !element.isDeleted && element.fileId
        ) as ExcalidrawImageElement[];
        if (images.length === 0) return;

        fetchImages(images.map(image => image.fileId!));
    }, [excalidrawAPI]);

    const firstRun = useRef(true);

    // fetch drawing on load
    useEffect(() => {
        if (!slug || !excalidrawAPI || firstRun.current === false) return;
        const getDrawing = async () => {
            setIsLoading(true);
            const elements = await fetchDrawing(slug);
            setIsLoading(false);

            if (!elements) return;

            const allButDeletedElements = removeDeletedElements(elements);
            setElements(allButDeletedElements);
            excalidrawAPI.updateScene({
                elements: allButDeletedElements,
            });
        };

        firstRun.current = false;
        getDrawing();
    }, [excalidrawAPI]);

    // save images on change
    useEffect(() => {
        if (!excalidrawAPI) return;

        const files = excalidrawAPI.getFiles();
        const images = Object.values(files).filter(file => file.mimeType.startsWith("image/"));
        const imagesReferencedOnCanvas = images.filter(
            image =>
                elements?.some(
                    element =>
                        element.type === "image" &&
                        element.fileId === image.id &&
                        element.isDeleted !== true
                )
        );

        const notUploadedImages = imagesReferencedOnCanvas.filter(
            image => !uploadedImages.includes(image.id)
        );

        if (!notUploadedImages.length) return;

        const saveImages = async () => {
            const res = await client.images.$post({
                json: notUploadedImages.map(image => ({
                    id: image.id,
                    data: image.dataURL,
                    mimeType: image.mimeType,
                })),
            });

            const json = await res.json();

            if (!json.success) {
                toast.error("Failed to save images");
                return;
            }

            setUploadedImages([...uploadedImages, ...notUploadedImages.map(image => image.id)]);
        };

        saveImages();
    }, [excalidrawAPI, elements]);

    const renderMenu = () => {
        return (
            <MainMenu>
                <MainMenu.Item
                    onSelect={async () => {
                        const elements = excalidrawAPI!.getSceneElementsIncludingDeleted();
                        const updatedSlug = await save(elements);
                        copyToClipboard(`${window.location.origin}/draw/${updatedSlug}`);
                        toast.success("Link copied to clipboard");

                        if (updatedSlug && slug !== updatedSlug) {
                            navigate(`/draw/${updatedSlug}`);
                        }
                    }}
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

    return (
        <div style={{ height: "100dvh" }}>
            {!isLoading && (
                <Excalidraw
                    ref={(api: ExcalidrawImperativeAPI) => setExcalidrawAPI(api)}
                    onChange={(e, state) => {
                        const allButDeletedNewElements = removeDeletedElements(e);
                        const allButDeletedOldElements = removeDeletedElements(elements);

                        if (isEqual(allButDeletedNewElements, allButDeletedOldElements)) {
                            return;
                        }

                        debouncedSetElements(structuredClone(allButDeletedNewElements));
                        debouncedSave(allButDeletedNewElements);
                    }}
                    initialData={{ elements }}
                    onPointerUpdate={e => {
                        const isDown = e.button === "down";

                        if (isPointerDown !== isDown) {
                            setIsPointerDown(prev => !prev);
                        }
                    }}
                >
                    {renderMenu()}
                </Excalidraw>
            )}
        </div>
    );
};
