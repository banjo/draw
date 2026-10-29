import { describe, expect, it } from "vitest";
import { isPrivateAddress, parseHead } from "./link-preview-service";

describe("isPrivateAddress", () => {
    it("blocks the server's own network", () => {
        for (const address of [
            "127.0.0.1",
            "10.1.2.3",
            "172.20.0.1",
            "192.168.1.1",
            "169.254.169.254",
            "0.0.0.0",
            "::1",
            "fd00::1",
            "fe80::1",
            "::ffff:127.0.0.1",
            "not an ip",
        ]) {
            expect(isPrivateAddress(address), address).toBe(true);
        }
    });

    it("allows public addresses", () => {
        for (const address of ["1.1.1.1", "140.82.121.3", "2606:4700:4700::1111"]) {
            expect(isPrivateAddress(address), address).toBe(false);
        }
    });
});

describe("parseHead", () => {
    const url = new URL("https://example.com/blog/post");

    it("prefers Open Graph, and decodes entities", () => {
        const page = parseHead(
            `<html><head>
                <title>Fallback</title>
                <meta property="og:title" content="Tom &amp; Jerry&#39;s &quot;post&quot;">
                <meta name="description" content='A   short
                    description'>
                <meta property="og:site_name" content="Example">
                <link rel="icon" href="/small.png" sizes="16x16">
                <link rel="icon" type="image/svg+xml" href="icon.svg">
            </head><body><meta property="og:title" content="Body"></body></html>`,
            url
        );
        expect(page).toEqual({
            title: `Tom & Jerry's "post"`,
            description: "A short description",
            siteName: "Example",
            icons: [
                "https://example.com/blog/icon.svg",
                "https://example.com/small.png",
                "https://example.com/favicon.ico",
            ],
        });
    });

    it("falls back to the title and /favicon.ico", () => {
        expect(parseHead("<title> Hello </title>", url)).toEqual({
            title: "Hello",
            description: undefined,
            siteName: undefined,
            icons: ["https://example.com/favicon.ico"],
        });
    });
});
