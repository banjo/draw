import type { IconifyInfo } from "@iconify/types";

export interface IconifySearchResponse {
    // List of icons, including prefixes
    icons: string[];

    // Number of results. If same as `limit`, more results are available
    total: number;

    // Number of results shown
    limit: number;

    // Index of first result
    start: number;

    // Info about icon sets
    collections: Record<string, IconifyInfo>;

    // Copy of request, values are string
    request: Record<string, string>;
}
