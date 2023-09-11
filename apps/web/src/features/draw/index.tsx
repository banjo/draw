import { client } from "@/lib/hc";
import { Excalidraw, MainMenu } from "@excalidraw/excalidraw";
import { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import { AppState, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import { useEffect, useState } from "react";

const renderMenu = () => {
    return (
        <MainMenu>
            <MainMenu.DefaultItems.SaveAsImage />
            <MainMenu.DefaultItems.Export />
            <MainMenu.Separator />
            <MainMenu.DefaultItems.LiveCollaborationTrigger
                isCollaborating={true}
                onSelect={() => window.alert("You clicked on collab button")}
            />
            <MainMenu.Item onSelect={() => console.log("clicked")} icon={<div>H</div>}>
                Custom item
            </MainMenu.Item>
            <MainMenu.DefaultItems.Help />
        </MainMenu>
    );
};

export const Draw = () => {
    const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);

    const [elements, setElements] = useState<readonly ExcalidrawElement[]>([]);
    const [appState, setAppState] = useState<AppState>();

    useEffect(() => {
        const getIt = async () => {
            const res = await client.draw.$get();
            const json = await res.json();

            const res2 = await client.test.$get();
            const json2 = await res2.json();

            console.log("🪕%c Banjo | index.tsx:36 | ", "color: #E91E63", json, json2);
        };

        getIt();
    }, []);

    return (
        <div style={{ height: "100vh" }}>
            <Excalidraw
                ref={(api: ExcalidrawImperativeAPI) => setExcalidrawAPI(api)}
                onChange={(elements, state) => {
                    setElements(elements);
                    setAppState(state);
                }}
            >
                {renderMenu()}
            </Excalidraw>
        </div>
    );
};
