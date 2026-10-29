import { useGlobal } from "@/contexts/global-context";
import { OnChangeCallback } from "@/features/draw/draw";
import { useGeneratedImages } from "@/features/draw/hooks/utils/use-generated-images";
import { NativeContainer } from "@/features/draw/models/native/native-container";
import { CustomDataUtil } from "@/features/draw/utils/custom-data-util";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { viewportCoordsToSceneCoords } from "@excalidraw/excalidraw";
import { ExcalidrawElement } from "common";
import React, { useRef } from "react";
import { LinkCardDialog } from "../components/link-card-dialog";
import { LinkCardMenuContainer } from "../components/link-card-menu";
import { LinkCard } from "../models/link-card";
import type { LinkContent } from "../models/link-card-render";
import { useLinkCardStore } from "../stores/use-link-card-store";
import { useLinkContent } from "./use-link-content";

const LINK_CARD_SELECTED_CLASS = "link-card-selected";

const isLiveCard = (element: ExcalidrawElement) =>
    CustomDataUtil.isLinkCard(element) && !element.isDeleted;

/** Link cards: their images, made in each browser, the dialog, the menu, and their links */
export const useLinkCards = () => {
    const { excalidrawApi } = useGlobal();
    const target = useLinkCardStore(state => state.target);
    const getLinkContent = useLinkContent();
    const { renderMissing } = useGeneratedImages(async card => {
        const { file } = await LinkCard.render(LinkCard.getContent(card));
        return { file, areas: undefined };
    });
    // Cards whose link is being followed, after it was changed in Excalidraw's link editor
    const following = useRef(new Set<string>());

    /** A card's link changed in Excalidraw's own editor gets the new page; a removed one comes back */
    const followLinks = (cards: ExcalidrawElement[]) => {
        if (!excalidrawApi) return;
        for (const card of cards) {
            const { url, look } = LinkCard.getContent(card);
            if (card.link === url || following.current.has(card.id)) continue;
            following.current.add(card.id);

            const next = card.link ? LinkCard.normalizeUrl(card.link) : undefined;
            const change: Promise<Partial<LinkContent>> = next
                ? getLinkContent(next, look)
                : Promise.resolve({ url });
            void change
                .then(content =>
                    LinkCard.apply(excalidrawApi, { id: card.id, changes: content, record: false })
                )
                .catch(() => undefined)
                .finally(() => following.current.delete(card.id));
        }
    };

    const updateLinkCards: OnChangeCallback = (elements, appState) => {
        const cards = elements.filter(isLiveCard);
        renderMissing(cards);
        followLinks(cards);

        const selection = ElementUtil.getSelectedElements(appState, elements);
        const [card] = selection;
        const selected =
            selection.length === 1 && card && isLiveCard(card)
                ? { id: card.id, ...LinkCard.getContent(card) }
                : undefined;
        const next = selected && { id: selected.id, look: selected.look, url: selected.url };
        const store = useLinkCardStore.getState();
        if (JSON.stringify(next) !== JSON.stringify(store.selected)) store.setSelected(next);

        // Excalidraw's hint is about cropping, which a card's image isn't for
        document.body.classList.toggle(LINK_CARD_SELECTED_CLASS, Boolean(next));
    };

    /** Double-clicking a card changes its link, instead of cropping */
    const onDoubleClickCapture = (event: React.MouseEvent) => {
        if (!excalidrawApi || !(event.target instanceof HTMLCanvasElement)) return;
        const { x, y } = viewportCoordsToSceneCoords(event, excalidrawApi.getAppState());
        const card = excalidrawApi
            .getSceneElements()
            .filter(isLiveCard)
            .findLast(e => x >= e.x && x <= e.x + e.width && y >= e.y && y <= e.y + e.height);
        if (!card) return;
        event.preventDefault();
        event.stopPropagation();
        useLinkCardStore.getState().open({ kind: "edit", id: card.id });
    };

    const close = () => {
        useLinkCardStore.getState().close();
        NativeContainer.parse();
        NativeContainer.focus();
    };

    const linkCards = excalidrawApi ? (
        <>
            {target ? <LinkCardDialog target={target} onClose={close} /> : null}
            <LinkCardMenuContainer />
        </>
    ) : null;

    return { linkCards, updateLinkCards, onDoubleClickCapture };
};
