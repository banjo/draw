import { includes, invariant, isDefined, take, wrapAsync } from "@banjoanton/utils";
import { ofetch } from "ofetch";
import { IconifySearchResponse } from "../types/iconify-search-response";

const ICON_GROUPS = ["logos"] as const;
type IconGroup = (typeof ICON_GROUPS)[number];

const ICONIFY_API_URL = "https://api.iconify.design";
const api = ofetch.create({ baseURL: ICONIFY_API_URL });

export type IconDto = {
    group: IconGroup;
    icon: string;
    url: string;
};

const buildIconifySearchUrl = (query: string, group: IconGroup) => {
    const params = new URLSearchParams();
    params.append("query", query);
    params.append("prefix", group);
    params.append("pretty", "true");
    params.append("limit", "32"); // minimum limit
    return `/search?${params.toString()}`;
};

const buildIconifyGetIconUrl = (icon: string, group: IconGroup) => `/${group}/${icon}.svg`;

const getIconifyIcon = async (icon: string, group: IconGroup) => {
    const url = buildIconifyGetIconUrl(icon, group);

    // const [res, error] = await wrapAsync(async () => await api<Blob>(url));
    //
    // if (error) {
    //     console.error(error);
    //     return undefined;
    // }

    const blobDto: IconDto = {
        group,
        icon,
        url: ICONIFY_API_URL + url,
    };

    return blobDto;
};

const searchIcons = async (query: string, group: IconGroup) => {
    const url = buildIconifySearchUrl(query, group);
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

    const iconPromises = firstFive.map(({ prefix, icon }) => getIconifyIcon(icon, prefix));
    const icons = await Promise.all(iconPromises);
    return icons.filter(isDefined);
};

export const IconService = { searchIcons };
