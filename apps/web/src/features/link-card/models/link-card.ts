import { loadBlockFonts } from "@/features/draw/models/block-fonts";
import { toSvgFile } from "@/features/draw/models/block-image";
import { ElementCreationUtil } from "@/features/draw/utils/element-creation-util";
import { UpdateElementUtil } from "@/features/draw/utils/update-element-util";
import { FileId } from "@excalidraw/excalidraw/element/types";
import { Mutable } from "@excalidraw/excalidraw/utility-types";
import { placeElements, Placement } from "@/features/add-element/hooks/use-insert-element";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { FrameUtil } from "@/features/draw/utils/frame-util";
import { CaptureUpdateAction, hashString } from "@excalidraw/excalidraw";
import { CustomDataLink, ExcalidrawApi, ExcalidrawElement, ExcalidrawImageElement } from "common";
import type { LinkContent, LinkLook } from "./link-card-render";

export const LINK_LOOKS: { look: LinkLook; label: string }[] = [
    { look: "compact", label: "Compact" },
    { look: "chip", label: "Chip" },
    { look: "sketchy", label: "Sketchy" },
];

/** What the API says about a page */
export type LinkPreview = Pick<LinkContent, "url" | "title" | "description" | "siteName" | "icon">;

// Bumped when the drawing changes, so cards get new images
const IMAGE_VERSION = 1;
const ICON_SIZE = 64;

const LOOKS = new Set<LinkLook>(["compact", "chip", "sketchy"]);

const getContent = (element: ExcalidrawElement): LinkContent => {
    const data = element.customData as Partial<CustomDataLink> | undefined;
    return {
        url: data?.url ?? "",
        title: data?.title,
        description: data?.description,
        siteName: data?.siteName,
        icon: data?.icon,
        look: data?.look && LOOKS.has(data.look) ? data.look : "compact",
    };
};

/** The same content always gets the same id, so every browser can make the file itself */
const getFileId = (content: LinkContent) => {
    const key = JSON.stringify(content);
    return `link-${IMAGE_VERSION}-${hashString(key)}-${key.length}` as FileId;
};

/** The card drawn, with its file and size at scale 1 */
const render = async (content: LinkContent) => {
    const [fonts, { renderLinkCard }] = await Promise.all([
        loadBlockFonts(),
        import("./link-card-render"),
    ]);
    const { svg, width, height } = renderLinkCard(content, fonts);
    return { file: toSvgFile(svg, getFileId(content)), width, height };
};

const toCustomData = (content: LinkContent): CustomDataLink => ({
    shadow: false,
    type: "link",
    ...content,
});

/** A new card at 0,0 with its file. The element links to the page, for Excalidraw's link icon */
const create = async (content: LinkContent) => {
    const { file, width, height } = await render(content);
    const element = ElementCreationUtil.createImage({
        base: { x: 0, y: 0, width, height },
        fileId: file.id,
        callback: draft => {
            draft.customData = toCustomData(content);
            draft.link = content.url;
            return draft;
        },
    });
    return { element, file };
};

/** The card with new content and its new file, at the scale it was resized to */
const update = async (element: ExcalidrawElement, changes: Partial<LinkContent>) => {
    const before = getContent(element);
    const after = { ...before, ...changes };
    const [previous, rendered] = await Promise.all([render(before), render(after)]);
    const scale = element.width / previous.width;

    const updated = UpdateElementUtil.updateElement(element, draft => {
        draft.customData = toCustomData(after);
        draft.link = after.url;
        (draft as Mutable<ExcalidrawImageElement>).fileId = rendered.file.id;
        draft.width = rendered.width * scale;
        draft.height = rendered.height * scale;
        return draft;
    });
    return { element: updated, file: rendered.file };
};

/** A web address, with https:// added when it's left out, or undefined if it isn't one */
const normalizeUrl = (input: string) => {
    const text = input.trim();
    if (!text || /\s/.test(text)) return undefined;
    const withScheme = /^[a-z][\w+.-]*:/i.test(text)
        ? text
        : `https://${text.replace(/^\/\//, "")}`;
    try {
        const url = new URL(withScheme);
        if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
        // A host like "localhost" or "example.com", not a single word
        if (!url.hostname.includes(".") && url.hostname !== "localhost") return undefined;
        return url.href;
    } catch {
        return undefined;
    }
};

// Sites Excalidraw embeds when their link is pasted, which stay embeds
const EMBEDDABLE = new Set([
    "youtube.com",
    "youtu.be",
    "vimeo.com",
    "player.vimeo.com",
    "figma.com",
    "link.excalidraw.com",
    "gist.github.com",
    "twitter.com",
    "x.com",
    "*.simplepdf.eu",
    "stackblitz.com",
    "val.town",
    "giphy.com",
    "reddit.com",
]);

const isEmbeddable = (url: string) => {
    try {
        const domain = new URL(url).hostname.replace(/^www\./, "");
        return EMBEDDABLE.has(domain) || EMBEDDABLE.has(domain.replace(/^[^.]+/, "*"));
    } catch {
        return false;
    }
};

/** A pasted web address that should become a card: one http(s) link, not an embed */
const parsePasted = (text: string) => {
    const trimmed = text.trim();
    if (!/^https?:\/\/\S+$/i.test(trimmed)) return undefined;
    const url = normalizeUrl(trimmed);
    return url && !isEmbeddable(url) ? url : undefined;
};

/** The icon as a small PNG, so the drawing stays small, or nothing if it can't be read */
const shrinkIcon = (dataUrl: string | undefined) =>
    new Promise<string | undefined>(resolve => {
        if (!dataUrl) return resolve(undefined);
        const image = new Image();
        image.onload = () => {
            try {
                const canvas = document.createElement("canvas");
                canvas.width = ICON_SIZE;
                canvas.height = ICON_SIZE;
                const ctx = canvas.getContext("2d")!;
                const ratio = image.naturalWidth / image.naturalHeight || 1;
                const width = ratio >= 1 ? ICON_SIZE : ICON_SIZE * ratio;
                const height = ratio >= 1 ? ICON_SIZE / ratio : ICON_SIZE;
                ctx.imageSmoothingQuality = "high";
                ctx.drawImage(
                    image,
                    (ICON_SIZE - width) / 2,
                    (ICON_SIZE - height) / 2,
                    width,
                    height
                );
                resolve(canvas.toDataURL("image/png"));
            } catch {
                resolve(undefined);
            }
        };
        image.onerror = () => resolve(undefined);
        image.src = dataUrl;
    });

/** What a card shows of a page, from the API's preview */
const fromPreview = async (preview: LinkPreview, look: LinkLook): Promise<LinkContent> => ({
    url: preview.url,
    title: preview.title ?? undefined,
    description: preview.description ?? undefined,
    siteName: preview.siteName ?? undefined,
    icon: await shrinkIcon(preview.icon ?? undefined),
    look,
});

/** A new card in the drawing at the placement, selected */
const insert = async (api: ExcalidrawApi, content: LinkContent, placement: Placement) => {
    const { element, file } = await create(content);
    const elements = FrameUtil.addToFrame(
        placeElements([element], placement),
        api.getSceneElements()
    );
    api.addFiles([file]);
    api.updateScene({
        elements: [...api.getSceneElementsIncludingDeleted(), ...elements],
        appState: ElementUtil.createNewElementSelection(elements, api.getAppState()).updatedState,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    return elements[0];
};

/** Changes a card in the drawing, as one undo step unless `record` is false */
const apply = async (
    api: ExcalidrawApi,
    { id, changes, record = true }: { id: string; changes: Partial<LinkContent>; record?: boolean }
) => {
    const current = api.getSceneElements().find(e => e.id === id);
    if (!current) return;
    const updated = await update(current, changes);
    api.addFiles([updated.file]);
    api.updateScene({
        elements: ElementUtil.mergeElements(api.getSceneElementsIncludingDeleted(), [
            updated.element,
        ]),
        captureUpdate: record ? CaptureUpdateAction.IMMEDIATELY : CaptureUpdateAction.NEVER,
    });
};

export const LinkCard = {
    insert,
    apply,
    getContent,
    getFileId,
    render,
    create,
    update,
    normalizeUrl,
    parsePasted,
    fromPreview,
};
