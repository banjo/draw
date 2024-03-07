import { useError } from "@/hooks/use-error";
import { trpc } from "@/lib/trpc";
import { Maybe, wrapAsync } from "@banjoanton/utils";
import { EditIcon, TrashIcon } from "lucide-react";
import { useRef } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { EditableLabel } from "../../../../../../packages/ui/src/components/shared/editable-label";
import { ResponsiveIcon } from "../../../../../../packages/ui/src/components/shared/responsive-icon";

type Props = {
    cardSlug: string;
    currentSlug: Maybe<string>;
    initialName: string;
    isOwner: boolean;
};

type EditableLabelRef = {
    startEditing: () => void;
    stopEditing: () => void;
    setText: (text: string) => void;
};

export const DrawingCard = ({ cardSlug, currentSlug, initialName, isOwner }: Props) => {
    const navigate = useNavigate();
    const utils = trpc.useContext();
    const { handleError } = useError();

    const editableLabelRef = useRef<EditableLabelRef>(null);
    const startEditing = () => editableLabelRef.current?.startEditing();
    const setLabelText = (text: string) => editableLabelRef.current?.setText(text);

    const updateDrawingName = async (slug: string, name: string) => {
        const [_, error] = await wrapAsync(
            async () => await utils.client.draw.updateDrawingName.mutate({ slug, name })
        );

        if (error) {
            await handleError(error, { toast: true });
            setLabelText(initialName);
            return;
        }
        utils.draw.getCollection.invalidate();

        toast.success("Drawing name updated");
    };

    const deleteDrawingFromCollection = async (e: React.MouseEvent, slug: string) => {
        e.stopPropagation();

        if (!window.confirm("Are you sure you want to delete this drawing?")) return;

        const [_, error] = await wrapAsync(
            async () => await utils.client.draw.deleteFromCollection.mutate({ slug })
        );

        if (error) {
            handleError(error, { toast: true });
            return;
        }

        utils.draw.getCollection.invalidate();
        toast.success("Drawing deleted from collection");
    };

    return (
        <div
            className={`rounded border text-card-foreground 
                                    shadow-sm w-full relative hover:bg-zinc-100 hover:cursor-pointer 
                                    px-4 py-2 flex gap-2 items-center 
                                    ${cardSlug === currentSlug ? "bg-zinc-50" : ""}`}
            onClick={() => navigate(`/draw/${cardSlug}`)}
        >
            <EditableLabel
                initialText={initialName}
                ref={editableLabelRef}
                onChange={newName => updateDrawingName(cardSlug, newName)}
                allowEditing={isOwner}
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
                    onClick={e => deleteDrawingFromCollection(e, cardSlug)}
                    size="xs"
                    tooltip="Delete"
                    enableTooltip
                />
            </div>
        </div>
    );
};
