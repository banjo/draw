import { useDrawing } from "@/features/draw/hooks/use-drawing";
import { useElementsState } from "@/features/draw/hooks/use-elements-state";
import { useImages } from "@/features/draw/hooks/use-images";
import { useMenu } from "@/features/draw/hooks/use-menu";
import { Maybe } from "@banjoanton/utils";
import { Excalidraw } from "@excalidraw/excalidraw";
import { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import { useState } from "react";

type DrawProps = {
    slug?: string;
};

export const Draw = ({ slug }: DrawProps) => {
    const { elements, setElements, debouncedSetElements } = useElementsState({ slug });
    const [excalidrawApi, setExcalidrawApi] = useState<Maybe<ExcalidrawImperativeAPI>>(undefined);

    const { saveDrawing, onDrawingChange } = useDrawing({
        excalidrawApi,
        slug,
        setElements,
        elements,
        debouncedSetElements,
    });

    const { renderMenu } = useMenu({ slug, excalidrawApi, saveDrawing });
    useImages({ elements, excalidrawApi });

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

    return (
        <div style={{ height: "100dvh" }}>
            <Excalidraw
                ref={(api: ExcalidrawImperativeAPI) => setExcalidrawApi(api)}
                onChange={onDrawingChange}
                initialData={{ elements }}
            >
                {renderMenu()}
            </Excalidraw>
        </div>
    );
};
