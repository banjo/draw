import { Icons } from "@/components/shared/icons";
import { ResponsiveIcon } from "@/components/shared/responsive-icon";
import { client } from "@/lib/hc";
import { debounce, isEqual } from "@banjoanton/utils";
import { Excalidraw, MainMenu } from "@excalidraw/excalidraw";
import { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";

type DrawProps = {
    slug?: string;
};

const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
};

export const Draw = ({ slug }: DrawProps) => {
    const navigate = useNavigate();

    const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
    const [elements, setElements] = useState<readonly ExcalidrawElement[]>([]);
    const [shouldSave, setShouldSave] = useState(() => !!slug);

    const [isLoading, setIsLoading] = useState(false);

    const debouncedSetElements = debounce((elements: readonly ExcalidrawElement[]) => {
        setElements(elements);
    }, 1500);

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
        if (!shouldSave || elements.length === 0) {
            return;
        }

        if (!ignore) {
            save();
        }

        return () => {
            ignore = true;
        };
    }, [elements]);

    const renderMenu = () => {
        return (
            <MainMenu>
                <MainMenu.Item
                    onSelect={async () => {
                        setShouldSave(true);
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
                        if (e.length === 0) {
                            return;
                        }

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
