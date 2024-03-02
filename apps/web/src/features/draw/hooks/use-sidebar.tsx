import { useAuth } from "@/contexts/auth-context";
import { DrawingCard } from "@/features/draw/components/drawing-card";
import { trpc } from "@/lib/trpc";
import { Maybe } from "@banjoanton/utils";
import { Sidebar } from "@excalidraw/excalidraw";
import { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import { useLocalStorage } from "@uidotdev/usehooks";
import { BrushIcon } from "lucide-react";
import { ResponsiveIcon } from "ui";

type In = {
    excalidrawApi: Maybe<ExcalidrawImperativeAPI>;
    slug: Maybe<string>;
};

const KEY_DOCKED_STATE = "banjo-docked-state";

export const useSidebar = ({ excalidrawApi, slug: currentSlug }: In) => {
    const [docked, setDocked] = useLocalStorage(KEY_DOCKED_STATE, false);
    const { user } = useAuth();

    const { data, isLoading } = trpc.draw.getCollection.useQuery(undefined, {
        enabled: !!user,
    });

    const toggleSidebar = () => excalidrawApi?.toggleSidebar({ name: "user" });

    const renderSidebar = () => {
        if (!user) return null;

        return (
            <Sidebar name="user" docked={docked} onDock={setDocked}>
                <Sidebar.Header
                    children="My collection"
                    className="text-xl font-bold text-[--color-primary]"
                />

                <div className="p-4">
                    {isLoading && "Loading..."}
                    <div className="flex flex-col gap-3">
                        {data?.map(({ name, slug, isOwner }) => (
                            <DrawingCard
                                cardSlug={slug}
                                currentSlug={currentSlug}
                                isOwner={isOwner}
                                name={name}
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
