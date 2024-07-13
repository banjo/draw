import { includes, invariant, isDefined, take, wrapAsync } from "@banjoanton/utils";
import { ofetch } from "ofetch";
import { IconifySearchResponse } from "../types/iconify-search-response";

const ICON_GROUPS = ["logos", "noto", "flagpack", "carbon"] as const;
type IconGroup = (typeof ICON_GROUPS)[number];

const ICON_GROUP_NAME_MAP: Record<IconGroup, string> = {
    logos: "Logos",
    noto: "Emojis",
    flagpack: "Flags",
    carbon: "General",
};

const ICONIFY_API_URL = "https://api.iconify.design";
const api = ofetch.create({ baseURL: ICONIFY_API_URL });

export type IconDto = {
    group: IconGroup;
    groupDisplayName: string;
    icon: string;
    url: string;
};

const buildIconifySearchUrl = (query: string) => {
    const params = new URLSearchParams();
    params.append("query", query);
    params.append("prefixes", ICON_GROUPS.join(","));
    params.append("pretty", "true");
    params.append("limit", "32"); // minimum limit
    return `/search?${params.toString()}`;
};

const buildIconifyGetIconUrl = (icon: string, group: IconGroup) => `/${group}/${icon}.svg`;

const getIconifyIcon = (icon: string, group: IconGroup) => {
    const url = buildIconifyGetIconUrl(icon, group);

    // const [res, error] = await wrapAsync(async () => await api<Blob>(url));
    //
    // if (error) {
    //     console.error(error);
    //     return undefined;
    // }

    const blobDto: IconDto = {
        group,
        groupDisplayName: ICON_GROUP_NAME_MAP[group],
        icon,
        url: ICONIFY_API_URL + url,
    };

    return blobDto;
};

const searchIcons = async (query: string) => {
    const url = buildIconifySearchUrl(query);
    const [res, error] = await wrapAsync(async () => await api<IconifySearchResponse>(url));

    if (error) {
        console.error(error);
        return [];
    }

    const firstFive = take(res.icons, 5).map(s => {
        const [prefix, icon] = s.split(":");
        invariant(prefix && icon, "Invalid icon format");

        if (!includes(ICON_GROUPS, prefix)) {
            throw new Error(`Invalid icon group: ${prefix}`);
        }

        return { prefix, icon };
    });

    const icons = firstFive.map(({ prefix, icon }) => getIconifyIcon(icon, prefix));
    return icons.filter(isDefined);
};

export const IconService = { searchIcons };
