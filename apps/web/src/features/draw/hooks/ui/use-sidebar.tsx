import { useAuth } from "@/contexts/auth-context";
import { useGlobal } from "@/contexts/global-context";
import { DrawingCard } from "@/features/draw/components/drawing-card";
import { useIsScrollable } from "@/features/draw/hooks/utils/use-is-scrollable";
import { useLatestCallback } from "@/hooks/use-latest-callback";
import { trpc } from "@/lib/trpc";
import { useSidebarStore } from "@/stores/use-sidebar-store";
import { Maybe } from "@banjoanton/utils";
import { Sidebar } from "@excalidraw/excalidraw";
import { useLocalStorage } from "@uidotdev/usehooks";
import { BrushIcon } from "lucide-react";
import { useMemo } from "react";
import { cn, ResponsiveIcon } from "ui";

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

    const { data, isLoading } = trpc.draw.getCollection.useQuery(undefined, {
        enabled: isAuthenticated,
    });

    const { isScrollable, scrollContainerRef } = useIsScrollable<HTMLDivElement>({
        dependencies: [isSidebarOpen, data?.length],
    });

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
                className="h-screen"
                onStateChange={state => {
                    setIsSidebarOpen(state !== null);
                }}
            >
                <Sidebar.Header
                    children="My collection"
                    className="text-xl font-bold text-[--color-primary]"
                />

                <div
                    className={cn(
                        "p-4 overflow-scroll relative h-full",
                        isScrollable &&
                            "after:content-[''] after:absolute after:inset-x-0 after:bottom-0 after:h-16 after:bg-gradient-to-t after:from-white after:opacity-50"
                    )}
                    ref={scrollContainerRef}
                >
                    {isLoading ? "Loading..." : null}
                    <div className="flex flex-col gap-3">
                        {data?.map(({ name, slug, isOwner }) => (
                            <DrawingCard
                                cardSlug={slug}
                                currentSlug={currentSlug}
                                isOwner={isOwner}
                                initialName={name}
                                key={slug}
                            />
                        ))}
                    </div>
                </div>
            </Sidebar>
        );
    }, [isAuthenticated, docked, data, isLoading, isScrollable, currentSlug]);

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
