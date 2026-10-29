import { trpc } from "@/lib/trpc";
import { LinkCard } from "../models/link-card";
import type { LinkContent, LinkLook } from "../models/link-card-render";

const STALE_TIME = 60 * 60 * 1000;

/**
 * What a card shows of a page: its title, description and icon from the API. Without the API,
 * e.g. offline, it's only the address.
 */
export const useLinkContent = () => {
    const utils = trpc.useUtils();

    return async (url: string, look: LinkLook): Promise<LinkContent> => {
        try {
            const preview = await utils.link.preview.fetch({ url }, { staleTime: STALE_TIME });
            return await LinkCard.fromPreview(preview, look);
        } catch {
            return { url, look };
        }
    };
};
