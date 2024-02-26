import { useAuth } from "@/contexts/auth-context";
import { Maybe } from "@banjoanton/utils";
import { Sidebar } from "@excalidraw/excalidraw";
import { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import { BrushIcon } from "lucide-react";
import { useState } from "react";
import { ResponsiveIcon } from "ui";

type In = {
    excalidrawApi: Maybe<ExcalidrawImperativeAPI>;
    slug: Maybe<string>;
};

export const useSidebar = ({ excalidrawApi }: In) => {
    const [docked, setDocked] = useState(false);
    const { user } = useAuth();

    const toggleSidebar = () => excalidrawApi?.toggleSidebar({ name: "user" });

    const renderSidebar = () => {
        if (!user) return null;

        return (
            <Sidebar name="user" docked={docked} onDock={setDocked}>
                <Sidebar.Header />
                <div>hello wolrd</div>
            </Sidebar>
        );
    };

    const renderSidebarButton = () => {
        if (!user) return null;

        return (
            <button className="sidebar-trigger" onClick={() => toggleSidebar()}>
                <ResponsiveIcon Icon={BrushIcon} />
                <span>Drawings</span>
            </button>
        );
    };

    return {
        renderSidebar,
        renderSidebarButton,
        toggleSidebar,
    };
};
