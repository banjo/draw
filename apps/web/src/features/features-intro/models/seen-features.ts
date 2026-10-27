import { Feature, FEATURES } from "./features";

const STORAGE_KEY = "banjo-seen-features";

const getSeenIds = (): string[] => {
    try {
        const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
        return Array.isArray(value) ? value.filter(id => typeof id === "string") : [];
    } catch {
        return [];
    }
};

const markSeen = (features: Feature[]) => {
    const ids = new Set([...getSeenIds(), ...features.map(feature => feature.id)]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
};

const getUnseen = () => {
    const seen = new Set(getSeenIds());
    return FEATURES.filter(feature => !seen.has(feature.id));
};

/** Which features this browser has been shown, so only new ones show next time */
export const SeenFeatures = {
    getSeenIds,
    getUnseen,
    markSeen,
};
