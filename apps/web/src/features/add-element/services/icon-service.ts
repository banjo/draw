import { getIconSet, IconCollection, IconSetId, isIconSetId, pickNames } from "../models/icon-sets";
import { IconItem } from "../models/add-element-item";
import { getIconData, iconToHTML, iconToSVG } from "@iconify/utils";
import type { IconifyJSON } from "@iconify/types";
import { FetchError, ofetch } from "ofetch";
import { IconifySearchResponse } from "../types/iconify-search-response";

// Iconify's own fallbacks, for when one of them is down or limits how often it's called
const HOSTS = ["https://api.iconify.design", "https://api.simplesvg.com", "https://api.unisvg.com"];
// Long lists of names make long URLs, which some servers refuse
const MAX_NAMES_PER_REQUEST = 80;
// Iconify's most, so a set with many matches doesn't crowd out the others
const SEARCH_LIMIT = 999;

/** An icon ready to draw: its SVG as a data URL, and its size */
export type IconImage = {
    dataUrl: string;
    width: number;
    height: number;
};

type CollectionResponse = {
    uncategorized?: string[];
    categories?: Record<string, string[]>;
};

const isRetryable = (error: unknown) =>
    !(error instanceof FetchError) ||
    error.statusCode === undefined ||
    error.statusCode === 429 ||
    error.statusCode >= 500;

/** Tries each host in turn, until one answers */
const request = async <T>(path: string): Promise<T> => {
    let lastError: unknown;
    for (const host of HOSTS) {
        try {
            return await ofetch<T>(path, { baseURL: host, retry: 0 });
        } catch (error) {
            lastError = error;
            if (!isRetryable(error)) break;
        }
    }
    throw lastError;
};

/** Icons matching the query, best first, in the given sets */
const searchIcons = async (query: string, sets: IconSetId[]): Promise<IconItem[]> => {
    const params = new URLSearchParams({
        query,
        prefixes: sets.join(","),
        limit: String(SEARCH_LIMIT),
    });
    const response = await request<IconifySearchResponse>(`/search?${params.toString()}`);

    const icons = response.icons.flatMap(icon => {
        const [set, name] = icon.split(":");
        return set && name && isIconSetId(set) ? [{ kind: "icon" as const, set, name }] : [];
    });

    // One of each icon, e.g. not all of its sizes
    const kept = new Set(
        sets.flatMap(set =>
            pickNames(
                set,
                icons.filter(icon => icon.set === set).map(icon => icon.name)
            ).map(name => `${set}:${name}`)
        )
    );
    return icons.filter(icon => kept.has(`${icon.set}:${icon.name}`));
};

/** Every icon in a set, without the old names Iconify keeps hidden */
const getCollection = async (set: IconSetId): Promise<IconCollection> => {
    const response = await request<CollectionResponse>(`/collection?prefix=${set}`);
    const order = getIconSet(set).categoryOrder ?? [];
    const rank = (title: string) => (order.includes(title) ? order.indexOf(title) : order.length);
    const categories = Object.entries(response.categories ?? {})
        .map(([title, names]) => ({ title, names: pickNames(set, names) }))
        .sort((a, b) => rank(a.title) - rank(b.title));
    const uncategorized = pickNames(set, response.uncategorized ?? []);
    const names = [...new Set([...uncategorized, ...categories.flatMap(c => c.names)])];

    return { names, categories };
};

const toBase64 = (text: string) => {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    for (const byte of bytes) binary += String.fromCodePoint(byte);
    return btoa(binary);
};

const toIconImage = (data: IconifyJSON, name: string): IconImage | undefined => {
    const icon = getIconData(data, name);
    if (!icon) return undefined;

    // The icon's own size, so it keeps its shape when drawn larger
    const { attributes, body, viewBox } = iconToSVG(icon, { height: "auto" });
    const svg = iconToHTML(body, attributes);
    return {
        dataUrl: `data:image/svg+xml;base64,${toBase64(svg)}`,
        width: viewBox[2],
        height: viewBox[3],
    };
};

/** The icons' SVGs, a few requests for many icons */
const getIconImages = async (set: IconSetId, names: string[]) => {
    const images = new Map<string, IconImage>();

    for (let start = 0; start < names.length; start += MAX_NAMES_PER_REQUEST) {
        const chunk = names.slice(start, start + MAX_NAMES_PER_REQUEST);
        const data = await request<IconifyJSON>(`/${set}.json?icons=${chunk.join(",")}`);
        for (const name of chunk) {
            const image = toIconImage(data, name);
            if (image) images.set(name, image);
        }
    }

    return images;
};

export const IconService = { searchIcons, getCollection, getIconImages };
