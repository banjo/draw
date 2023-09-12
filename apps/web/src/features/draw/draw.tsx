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
import { useEffect, useState } from "react";
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

export const Draw = ({ slug }: DrawProps) => {
    const navigate = useNavigate();
    const localStorageKey = `drawing-${slug ?? "base"}`;

    const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
    const [elements, setElements, remove] = useLocalStorage<readonly ExcalidrawElement[]>(
        localStorageKey,
        []
    );

    const [isLoading, setIsLoading] = useState(false);
    const [uploadedImages, setUploadedImages] = useState<string[]>([]);

    const debouncedSetElements = debounce((elements: readonly ExcalidrawElement[]) => {
        setElements(elements);
    }, 500);

    const save = async () => {
        const currentSlug = slug ?? uuidv4();
        const res = await client.draw.$post({
            json: {
                elements: elements as any,
                slug: currentSlug,
            },
        });

        const data = await res.json();

        if (!data.success) {
            return;
        }

        return currentSlug;
    };

    // get images on load
    useEffect(() => {
        if (!elements || !excalidrawAPI) return;

        const images = elements.filter(
            element => element.type === "image" && !element.isDeleted && element.fileId
        ) as ExcalidrawImageElement[];
        if (images.length === 0) return;

        const fetchImages = async (ids: string[]) => {
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

        fetchImages(images.map(image => image.fileId!));
    }, [excalidrawAPI]);

    useEffect(() => {
        if (!slug) return;

        setIsLoading(true);
        const fetchDraw = async () => {
            const res = await client.draw[":slug"].$get({
                param: {
                    slug,
                },
            });
            const json = await res.json();

            setIsLoading(false);

            if (!json.success) {
                navigate("/");
                return;
            }

            if (!json.success) {
                navigate("/");
                return;
            }

            setElements(json.data.data as unknown as ExcalidrawElement[]);
        };
        fetchDraw();
    }, [slug]);

    useEffect(() => {
        let ignore = false;
        if (!slug || !elements || elements.length === 0) {
            return;
        }

        if (!ignore) {
            save();
        }

        return () => {
            ignore = true;
        };
    }, [elements]);

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
                        const updatedSlug = await save();
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
                        if (!isEqual(e, elements)) {
                            debouncedSetElements([...e]);
                        }
                    }}
                    initialData={{ elements }}
                >
                    {renderMenu()}
                </Excalidraw>
            )}
        </div>
    );
};
