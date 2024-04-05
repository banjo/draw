import { useAuth } from "@/contexts/auth-context";
import { useGlobal } from "@/contexts/global-context";
import { DrawingCard } from "@/features/draw/components/drawing-card";
import { useIsScrollable } from "@/features/draw/hooks/utils/use-is-scrollable";
import { trpc } from "@/lib/trpc";
import { Maybe } from "@banjoanton/utils";
import { Sidebar } from "@excalidraw/excalidraw";
import { useLocalStorage } from "@uidotdev/usehooks";
import { BrushIcon } from "lucide-react";
import { useState } from "react";
import { ResponsiveIcon, cn } from "ui";

type In = {
    slug: Maybe<string>;
};

const KEY_DOCKED_STATE = "banjo-docked-state";

export const useSidebar = ({ slug: currentSlug }: In) => {
    const { excalidrawApi } = useGlobal();
    const [docked, setDocked] = useLocalStorage(KEY_DOCKED_STATE, false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { user } = useAuth();

    const { data, isLoading } = trpc.draw.getCollection.useQuery(undefined, {
        enabled: !!user,
    });

    const { isScrollable, scrollContainerRef } = useIsScrollable<HTMLDivElement>({
        dependencies: [isSidebarOpen, data?.length],
    });

    const toggleSidebar = () => excalidrawApi?.toggleSidebar({ name: "user" });

    const renderSidebar = () => {
        if (!user) return null;

        return (
            <Sidebar
                name="user"
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
                        "p-4 overflow-scroll relative",
                        isScrollable &&
                            "after:content-[''] after:absolute after:inset-x-0 after:bottom-0 after:h-16 after:bg-gradient-to-t after:from-white after:opacity-50"
                    )}
                    ref={scrollContainerRef}
                >
                    {isLoading && "Loading..."}
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
    };

    const renderSidebarButton = () => {
        if (!user) return null;

        return (
            <button className="sidebar-trigger" onClick={() => toggleSidebar()}>
                <ResponsiveIcon Icon={BrushIcon} />
                <span>Collection</span>
            </button>
        );
    };

    return {
        renderSidebar,
        renderSidebarButton,
        toggleSidebar,
    };
};
