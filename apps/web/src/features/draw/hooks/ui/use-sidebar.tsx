import { useAuth } from "@/contexts/auth-context";
import { useGlobal } from "@/contexts/global-context";
import { CollectionExplorer } from "@/features/collection/components/explorer/collection-explorer";
import { useLatestCallback } from "@/hooks/use-latest-callback";
import { useSidebarStore } from "@/stores/use-sidebar-store";
import { Maybe } from "@banjoanton/utils";
import { Sidebar } from "@excalidraw/excalidraw";
import { useLocalStorage } from "@uidotdev/usehooks";
import { BrushIcon } from "lucide-react";
import { useMemo } from "react";
import { ResponsiveIcon } from "ui";

type In = {
    slug: Maybe<string>;
};

const KEY_DOCKED_STATE = "banjo-docked-state";
const SIDEBAR_NAME = "user";

export const useSidebar = ({ slug: currentSlug }: In) => {
    const { excalidrawApi } = useGlobal();
    const [docked, setDocked] = useLocalStorage(KEY_DOCKED_STATE, false);
    // Kept in a store, so the sidebar stays open when the drawing remounts
    const isSidebarOpen = useSidebarStore(s => s.isSidebarOpen);
    const setIsSidebarOpen = useSidebarStore(s => s.setIsSidebarOpen);
    const { isAuthenticated } = useAuth();

    const toggleSidebar = useLatestCallback(() =>
        excalidrawApi?.toggleSidebar({ name: SIDEBAR_NAME })
    );

    const initialOpenSidebar = isAuthenticated && isSidebarOpen ? { name: SIDEBAR_NAME } : null;

    // Stable elements, so Excalidraw only re-renders when the sidebar itself changes
    const sidebar = useMemo(() => {
        if (!isAuthenticated) return null;

        return (
            <Sidebar
                name={SIDEBAR_NAME}
                docked={docked}
                onDock={setDocked}
                onStateChange={state => {
                    setIsSidebarOpen(state !== null);
                }}
            >
                <Sidebar.Header className="text-[17px] font-bold">Collection</Sidebar.Header>
                <CollectionExplorer currentSlug={currentSlug ?? undefined} />
            </Sidebar>
        );
    }, [isAuthenticated, docked, currentSlug]);

    const sidebarButton = useMemo(() => {
        if (!isAuthenticated) return null;

        return (
            <button className="sidebar-trigger" onClick={() => toggleSidebar()}>
                <ResponsiveIcon Icon={BrushIcon} />
                <span>Collection</span>
            </button>
        );
    }, [isAuthenticated]);

    return {
        sidebar,
        sidebarButton,
        toggleSidebar,
        initialOpenSidebar,
    };
};
