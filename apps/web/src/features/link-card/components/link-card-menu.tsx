import { useGlobal } from "@/contexts/global-context";
import {
    ActionButton,
    BlockSettings,
    ButtonRow,
    Choices,
    Setting,
} from "@/features/draw/components/block-settings";
import { NativeBlockSettings } from "@/features/draw/models/native/native-block-settings";
import { ExternalLink, Pencil } from "lucide-react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { LINK_LOOKS, LinkCard } from "../models/link-card";
import type { LinkLook } from "../models/link-card-render";
import { useLinkCardStore } from "../stores/use-link-card-store";

/** The page's address without "https://" and "www." */
const shortUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

/** A card's look, its link and opening it, in Excalidraw's sidebar */
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
        <BlockSettings>
            <Setting label="Look">
                <Choices
                    options={LINK_LOOKS.map(option => ({
                        value: option.look,
                        label: option.label,
                    }))}
                    value={look}
                    onChange={value => void changeLook(value)}
                />
            </Setting>
            <Setting label="Link">
                <div
                    title={url}
                    className="truncate rounded-lg px-2 py-1.5 text-[0.75rem] text-[var(--color-gray-60,#7a7a7a)] shadow-[inset_0_0_0_1px_var(--default-border-color)]"
                >
                    {shortUrl(url)}
                </div>
            </Setting>
            <ButtonRow>
                <ActionButton
                    isPrimary
                    shortcut="↵"
                    icon={<Pencil className="h-3.5 w-3.5" />}
                    onClick={() => useLinkCardStore.getState().open({ kind: "edit", id })}
                >
                    Edit
                </ActionButton>
                <ActionButton
                    title="Open the page in a new tab"
                    icon={<ExternalLink className="h-3.5 w-3.5" />}
                    onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
                >
                    Open
                </ActionButton>
            </ButtonRow>
        </BlockSettings>
    );
};

/** In Excalidraw's sidebar while a card is selected */
export const LinkCardMenuContainer = () => {
    const selected = useLinkCardStore(state => state.selected);
    if (!selected) return null;
    return createPortal(<LinkCardMenu {...selected} />, NativeBlockSettings.container);
};
