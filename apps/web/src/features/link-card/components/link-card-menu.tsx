import { useGlobal } from "@/contexts/global-context";
import { NativeBlockMenu } from "@/features/draw/models/native/native-block-menu";
import { ExternalLink, Pencil } from "lucide-react";
import { ReactNode } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { cn } from "ui";
import { LINK_LOOKS, LinkCard } from "../models/link-card";
import type { LinkLook } from "../models/link-card-render";
import { useLinkCardStore } from "../stores/use-link-card-store";

const GROUP_CLASS =
    "flex h-full items-center gap-0.5 rounded-lg bg-[#ECECF4] p-1 dark:bg-[#23232A]";

const Option = ({
    isActive,
    onClick,
    children,
    label,
}: {
    isActive?: boolean;
    onClick: () => void;
    children: ReactNode;
    label?: string;
}) => (
    <button
        type="button"
        onClick={onClick}
        aria-pressed={isActive}
        aria-label={label}
        title={label}
        className={cn(
            "flex h-full items-center gap-1.5 whitespace-nowrap rounded-md px-2.5",
            isActive
                ? "bg-[#e0dfff] font-semibold text-[#4a47b1] dark:bg-[#403e6a] dark:text-[#e0dfff]"
                : "hover:bg-black/5 dark:hover:bg-white/10"
        )}
    >
        {children}
    </button>
);

/** A card's look, changing its link and opening it, while it's selected */
const LinkCardMenu = ({ id, look, url }: { id: string; look: LinkLook; url: string }) => {
    const { excalidrawApi } = useGlobal();

    const changeLook = async (next: LinkLook) => {
        if (!excalidrawApi) return;
        try {
            await LinkCard.apply(excalidrawApi, { id, changes: { look: next } });
        } catch {
            toast.error("Couldn't draw the card");
        }
    };

    return (
        <div className="pointer-events-auto absolute z-[3] flex h-full items-center gap-2 text-sm">
            <div className={GROUP_CLASS}>
                {LINK_LOOKS.map(option => (
                    <Option
                        key={option.look}
                        isActive={look === option.look}
                        onClick={() => void changeLook(option.look)}
                    >
                        {option.label}
                    </Option>
                ))}
            </div>
            <div className={GROUP_CLASS}>
                <Option onClick={() => useLinkCardStore.getState().open({ kind: "edit", id })}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit link
                </Option>
                <Option
                    label="Open the page"
                    onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
                >
                    <ExternalLink className="h-3.5 w-3.5" />
                </Option>
            </div>
        </div>
    );
};

/** In Excalidraw's footer while a card is selected */
export const LinkCardMenuContainer = () => {
    const selected = useLinkCardStore(state => state.selected);
    const container = NativeBlockMenu.getContainer();
    if (!selected || !container) return null;
    return createPortal(<LinkCardMenu {...selected} />, container);
};
