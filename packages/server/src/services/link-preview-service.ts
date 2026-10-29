import { lookup as dnsLookup, LookupAddress } from "node:dns";
import http, { IncomingMessage } from "node:http";
import https from "node:https";
import { BlockList, isIP } from "node:net";
import { createContextLogger } from "../lib/context-logger";

const logger = createContextLogger("link-preview-service");

export type LinkPreview = {
    url: string;
    title?: string;
    description?: string;
    siteName?: string;
    /** The page's icon as a data URL */
    icon?: string;
};

const TIMEOUT = 5000;
const MAX_REDIRECTS = 4;
// Enough for the <head> of almost any page
const MAX_PAGE_BYTES = 512 * 1024;
const MAX_ICON_BYTES = 100 * 1024;
const USER_AGENT = "Mozilla/5.0 (compatible; BanjoDraw/1.0; +https://draw.banjoanton.com)";

// Addresses on the server's own network, which a link mustn't reach
const PRIVATE = new BlockList();
for (const [network, prefix] of [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["224.0.0.0", 3],
] as const) {
    PRIVATE.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
    ["::", 128],
    ["::1", 128],
    ["64:ff9b::", 96],
    ["fc00::", 7],
    ["fe80::", 10],
    ["ff00::", 8],
] as const) {
    PRIVATE.addSubnet(network, prefix, "ipv6");
}

export const isPrivateAddress = (address: string) => {
    const family = isIP(address);
    if (family === 0) return true;
    // IPv4 addresses written as IPv6, like ::ffff:127.0.0.1, are checked with the IPv4 rules
    return PRIVATE.check(address, family === 4 ? "ipv4" : "ipv6");
};

/** Looks up a host like Node does, but fails for private addresses, checked when connecting */
const publicLookup: typeof dnsLookup = ((
    hostname: string,
    options: object,
    callback: (error: Error | null, address: string | LookupAddress[], family?: number) => void
) =>
    dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
        if (error) return callback(error, "");
        const list = addresses as LookupAddress[];
        if (list.length === 0 || list.some(({ address }) => isPrivateAddress(address))) {
            return callback(new Error(`Blocked address for ${hostname}`), "");
        }
        if ((options as { all?: boolean }).all) return callback(null, list);
        const [first] = list;
        callback(null, first!.address, first!.family);
    })) as typeof dnsLookup;

type Fetched = { url: URL; contentType: string; body: Buffer };

type Request = { maxBytes: number; accept: string; redirects?: number };

/** GETs a public http(s) URL, following a few redirects, reading at most `maxBytes` */
const get = (url: URL, { maxBytes, accept, redirects = 0 }: Request): Promise<Fetched> =>
    new Promise((resolve, reject) => {
        if (url.protocol !== "http:" && url.protocol !== "https:") {
            reject(new Error("Only http and https"));
            return;
        }
        if (
            isIP(url.hostname.replace(/^\[|\]$/g, "")) &&
            isPrivateAddress(url.hostname.replace(/^\[|\]$/g, ""))
        ) {
            reject(new Error("Blocked address"));
            return;
        }

        const client = url.protocol === "https:" ? https : http;
        const request = client.get(
            url,
            {
                lookup: publicLookup,
                timeout: TIMEOUT,
                headers: { "user-agent": USER_AGENT, accept, "accept-language": "en" },
            },
            (response: IncomingMessage) => {
                const status = response.statusCode ?? 0;
                const location = response.headers.location;
                if (status >= 300 && status < 400 && location) {
                    response.resume();
                    if (redirects >= MAX_REDIRECTS) return reject(new Error("Too many redirects"));
                    return resolve(
                        get(new URL(location, url), { maxBytes, accept, redirects: redirects + 1 })
                    );
                }
                if (status < 200 || status >= 300) {
                    response.resume();
                    return reject(new Error(`Status ${status}`));
                }

                const chunks: Buffer[] = [];
                let size = 0;
                const done = () =>
                    resolve({
                        url,
                        contentType: String(response.headers["content-type"] ?? ""),
                        body: Buffer.concat(chunks),
                    });
                response.on("data", (chunk: Buffer) => {
                    chunks.push(chunk);
                    size += chunk.length;
                    if (size >= maxBytes) {
                        response.destroy();
                        done();
                    }
                });
                response.on("end", done);
                response.on("error", reject);
            }
        );
        request.on("timeout", () => request.destroy(new Error("Timed out")));
        request.on("error", reject);
    });

const ENTITIES: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    ndash: "–",
    mdash: "—",
    hellip: "…",
    middot: "·",
    rsquo: "’",
    lsquo: "‘",
    rdquo: "”",
    ldquo: "“",
};

const decode = (text: string) =>
    text
        .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
            if (code[0] === "#") {
                const point =
                    code[1]?.toLowerCase() === "x"
                        ? parseInt(code.slice(2), 16)
                        : parseInt(code.slice(1), 10);
                return Number.isFinite(point) && point > 0 && point <= 0x10ffff
                    ? String.fromCodePoint(point)
                    : match;
            }
            return ENTITIES[code.toLowerCase()] ?? match;
        })
        .replace(/\s+/g, " ")
        .trim();

const getAttributes = (tag: string) => {
    const attributes: Record<string, string> = {};
    for (const [, name, , double, single, bare] of tag.matchAll(
        /([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g
    )) {
        attributes[name!.toLowerCase()] = double ?? single ?? bare ?? "";
    }
    return attributes;
};

type ParsedPage = Omit<LinkPreview, "url" | "icon"> & { icons: string[] };

/** The content of each <meta>, by its property or name, the first of each */
const getMeta = (head: string) => {
    const meta: Record<string, string> = {};
    for (const [tag] of head.matchAll(/<meta\b[^>]*>/gi)) {
        const attributes = getAttributes(tag);
        const key = (attributes.property ?? attributes.name ?? "").toLowerCase();
        if (key && attributes.content !== undefined && !(key in meta)) {
            meta[key] = decode(attributes.content);
        }
    }
    return meta;
};

/** How good an icon is: big enough to be sharp, small enough to be quick. 0 isn't an icon */
const getIconRank = (attributes: Record<string, string>) => {
    const rel = (attributes.rel ?? "").toLowerCase().split(/\s+/);
    if (rel.includes("apple-touch-icon")) return 2;
    if (!rel.includes("icon")) return 0;
    const size = Number(attributes.sizes?.split("x")[0]) || 0;
    return size >= 32 || attributes.type === "image/svg+xml" ? 3 : 1;
};

/** The icons in <link>s, best first */
const getIcons = (head: string, pageUrl: URL) => {
    const icons: { href: string; rank: number }[] = [];
    for (const [tag] of head.matchAll(/<link\b[^>]*>/gi)) {
        const attributes = getAttributes(tag);
        const rank = getIconRank(attributes);
        if (!attributes.href || rank === 0) continue;
        try {
            icons.push({ href: new URL(decode(attributes.href), pageUrl).href, rank });
        } catch {
            // A broken href
        }
    }
    return icons.sort((a, b) => b.rank - a.rank).map(icon => icon.href);
};

/** The title, description, site name and icons in a page's <head> */
export const parseHead = (html: string, pageUrl: URL): ParsedPage => {
    const head = html.slice(0, html.search(/<\/head>/i) + 1 || undefined);
    const meta = getMeta(head);
    const title =
        meta["og:title"] ??
        meta["twitter:title"] ??
        decode(head.match(/<title[^>]*>([^<]*)/i)?.[1] ?? "");
    const description = meta["og:description"] ?? meta["twitter:description"] ?? meta.description;
    return {
        title: title || undefined,
        description: description || undefined,
        siteName: meta["og:site_name"] || undefined,
        icons: [...getIcons(head, pageUrl), new URL("/favicon.ico", pageUrl).href],
    };
};

const clip = (text: string | undefined, length: number) =>
    text && text.length > length ? `${text.slice(0, length - 1)}…` : text;

const fetchIcon = async (urls: string[]) => {
    for (const url of [...new Set(urls)].slice(0, 3)) {
        try {
            const icon = await get(new URL(url), {
                maxBytes: MAX_ICON_BYTES + 1,
                accept: "image/*",
            });
            const type = icon.contentType.split(";")[0]!.trim().toLowerCase();
            if (!type.startsWith("image/") || icon.body.length > MAX_ICON_BYTES) continue;
            if (icon.body.length === 0) continue;
            return `data:${type};base64,${icon.body.toString("base64")}`;
        } catch {
            // The next one
        }
    }
    return undefined;
};

const cache = new Map<string, { preview: LinkPreview; expires: number }>();
const CACHE_TIME = 60 * 60 * 1000;
const CACHE_SIZE = 500;

/** A page's title, description, site name and icon, for a link card */
const getPreview = async (link: string): Promise<LinkPreview> => {
    const cached = cache.get(link);
    if (cached && cached.expires > Date.now()) return cached.preview;

    const url = new URL(link);
    let preview: LinkPreview = { url: url.href };
    try {
        const page = await get(url, {
            maxBytes: MAX_PAGE_BYTES,
            accept: "text/html,application/xhtml+xml",
        });
        const isHtml = /html/i.test(page.contentType);
        const parsed = isHtml
            ? parseHead(page.body.toString("utf8"), page.url)
            : { icons: [new URL("/favicon.ico", page.url).href] };
        preview = {
            url: url.href,
            title: clip(parsed.title, 300),
            description: clip(parsed.description, 500),
            siteName: clip(parsed.siteName, 100),
            icon: await fetchIcon(parsed.icons),
        };
    } catch (error) {
        logger.info({ error: (error as Error).message, link }, "Could not get a link preview");
        // Only the icon, which the site may still have
        preview.icon = await fetchIcon([new URL("/favicon.ico", url).href]);
    }

    if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value!);
    cache.set(link, { preview, expires: Date.now() + CACHE_TIME });
    return preview;
};

export const LinkPreviewService = { getPreview };
