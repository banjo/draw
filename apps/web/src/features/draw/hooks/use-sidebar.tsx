import { useAuth } from "@/contexts/auth-context";
import { EditableLabel } from "@/features/draw/components/editable-label";
import { trpc } from "@/lib/trpc";
import { Maybe, attemptAsync, isUndefined } from "@banjoanton/utils";
import { Sidebar } from "@excalidraw/excalidraw";
import { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import { BrushIcon, EditIcon, TrashIcon } from "lucide-react";
import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { ResponsiveIcon } from "ui";

type In = {
    excalidrawApi: Maybe<ExcalidrawImperativeAPI>;
    slug: Maybe<string>;
};

type EditableLabelRef = {
    startEditing: () => void;
    stopEditing: () => void;
};

export const useSidebar = ({ excalidrawApi, slug: currentSlug }: In) => {
    const [docked, setDocked] = useState(false);
    const navigate = useNavigate();
    const { user } = useAuth();
    const utils = trpc.useContext();

    const editableLabelRef = useRef<EditableLabelRef>(null);
    const startEditing = () => editableLabelRef.current?.startEditing();

    const { data, isLoading } = trpc.draw.getCollection.useQuery();

    const toggleSidebar = () => excalidrawApi?.toggleSidebar({ name: "user" });

    const deleteDrawingFromCollection = async (e: React.MouseEvent, slug: string) => {
        e.stopPropagation();

        const res = await attemptAsync(
            async () => await utils.client.draw.deleteFromCollection.mutate({ slug })
        );

        if (isUndefined(res)) {
            toast.error("Error deleting drawing");
            return;
        }

        utils.draw.getCollection.invalidate();
        toast.success("Drawing deleted from collection");
    };

    const updateDrawingName = async (slug: string, name: string) => {
        const res = await attemptAsync(
            async () => await utils.client.draw.updateDrawingName.mutate({ slug, name })
        );

        if (isUndefined(res)) {
            toast.error("Only the owner can update the drawing name");
            return;
        }

        utils.draw.getCollection.invalidate();
        toast.success("Drawing name updated");
    };

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
                    <div className="flex flex-col gap-4">
                        {data?.map(({ name, slug, isOwner }) => (
                            <div
                                className={`rounded-lg border text-card-foreground 
                                    shadow-sm w-full relative hover:bg-zinc-100 hover:cursor-pointer 
                                    px-4 py-2 flex gap-2 items-center 
                                    ${slug === currentSlug ? "bg-zinc-50" : ""}`}
                                onClick={() => navigate(`/draw/${slug}`)}
                                key={slug}
                            >
                                <EditableLabel
                                    initialText={name}
                                    ref={editableLabelRef}
                                    onChange={newName => updateDrawingName(slug, newName)}
                                />

                                <div className="ml-auto flex gap-2">
                                    {isOwner && (
                                        <ResponsiveIcon
                                            Icon={EditIcon}
                                            onClick={startEditing}
                                            size="xs"
                                            tooltip="Change name"
                                            enableTooltip
                                        />
                                    )}

                                    <ResponsiveIcon
                                        Icon={TrashIcon}
                                        onClick={e => deleteDrawingFromCollection(e, slug)}
                                        size="xs"
                                        tooltip="Delete"
                                        enableTooltip
                                    />
                                </div>
                            </div>
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
