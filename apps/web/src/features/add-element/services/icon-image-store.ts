import { IconSetId } from "../models/icon-sets";
import { IconImage, IconService } from "./icon-service";

/** The icons shown so far. "missing" when Iconify doesn't have it. */
const images = new Map<string, IconImage | "missing">();
const loading = new Set<string>();
const queued = new Map<IconSetId, Set<string>>();
const listeners = new Set<() => void>();
let flushTimer: ReturnType<typeof setTimeout> | undefined;

const keyOf = (set: IconSetId, name: string) => `${set}:${name}`;

const notify = () => listeners.forEach(listener => listener());

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

/** Loads the icons asked for at about the same time together, a request per set */
const flush = () => {
    flushTimer = undefined;
    const batches = [...queued.entries()];
    queued.clear();

    for (const [set, names] of batches) {
        const list = [...names];
        IconService.getIconImages(set, list)
            .then(found => {
                for (const name of list) images.set(keyOf(set, name), found.get(name) ?? "missing");
            })
            // Not marked as missing, so it's tried again the next time it's shown
            .catch(() => undefined)
            .finally(() => {
                list.forEach(name => loading.delete(keyOf(set, name)));
                notify();
            });
    }
};

const load = (set: IconSetId, name: string) => {
    const key = keyOf(set, name);
    if (images.has(key) || loading.has(key)) return;

    loading.add(key);
    const names = queued.get(set) ?? new Set();
    names.add(name);
    queued.set(set, names);
    flushTimer ??= setTimeout(flush, 16);
};

const get = (set: IconSetId, name: string) => images.get(keyOf(set, name));

/** The icon's image, from what's shown already or else from Iconify */
const getIconImage = async (set: IconSetId, name: string) => {
    const cached = images.get(keyOf(set, name));
    if (cached && cached !== "missing") return cached;

    const found = await IconService.getIconImages(set, [name]);
    const image = found.get(name);
    if (!image) throw new Error(`Icon not found: ${set}:${name}`);

    images.set(keyOf(set, name), image);
    return image;
};

export const IconImageStore = { subscribe, get, load, getIconImage };
