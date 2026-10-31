// Install Playwright separately, then set PLAYWRIGHT_PACKAGE to its index.mjs if needed.
// BASE_URL defaults to the local dev server; EVIDENCE_DIR holds screenshots and results.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const { chromium, webkit } = await import(process.env.PLAYWRIGHT_PACKAGE || "playwright");
const baseURL = process.env.BASE_URL || "http://localhost:3005";
const evidence = process.env.EVIDENCE_DIR || "artifacts/mobile-toolbar";
await mkdir(evidence, { recursive: true });
const results = [];

for (const [engine, browserType] of [
    ["chromium", chromium],
    ["webkit", webkit],
]) {
    const browser = await browserType.launch({ headless: true });
    try {
        for (const [name, width, height, mobile] of [
            ["small-phone", 320, 568, true],
            ["iphone", 390, 844, true],
            ["landscape", 844, 390, true],
            ["desktop", 1280, 800, false],
            ["narrow-desktop", 900, 700, false],
        ]) {
            const context = await browser.newContext({
                viewport: { width, height },
                isMobile: mobile,
                hasTouch: mobile,
                deviceScaleFactor: 1,
            });
            const page = await context.newPage();
            const errors = [];
            page.on("pageerror", error => errors.push(error.message));
            await page.goto(baseURL);
            const start = page.getByRole("button", { name: "Start drawing", exact: true });
            await start.waitFor({ state: "visible", timeout: 20000 });
            await start.click();
            await start.waitFor({ state: "hidden" });
            await page.locator(".excalidraw").waitFor();
            const toolbar = page.locator('#custom-dock [role="toolbar"]');
            await toolbar.waitFor({ state: "visible", timeout: 15000 });
            assert.equal(
                await page
                    .locator(".excalidraw")
                    .evaluate(el => el.classList.contains("excalidraw--mobile")),
                mobile
            );
            const rect = await toolbar.boundingBox();
            assert(
                rect.x >= 0 && rect.x + rect.width <= width + 1,
                `${engine}/${name}: dock clipped`
            );
            const buttons = toolbar.locator(":scope > button, :scope > div > button");
            assert.equal(await buttons.count(), 10);
            for (const button of await buttons.all()) {
                const box = await button.boundingBox();
                assert(
                    box &&
                        box.x >= 0 &&
                        box.y >= 0 &&
                        box.x + box.width <= width + 1 &&
                        box.y + box.height <= height + 1
                );
                if (mobile)
                    assert(box.width >= 44 && box.height >= 44, "touch target smaller than 44px");
            }
            if (mobile) {
                assert.equal(await page.locator(".App-toolbar--mobile").isVisible(), false);
                const bar = await page.locator(".App-bottom-bar > .Island").boundingBox();
                assert(rect.y + rect.height <= bar.y, "dock overlaps native controls");
            }
            await page.screenshot({ path: join(evidence, `${engine}-${name}.png`) });
            const shapes = toolbar.getByRole("button", { name: "Shapes", exact: true });
            if (mobile) await shapes.tap();
            else await shapes.click();
            if (mobile) await shapes.tap();
            else await shapes.click();
            await page.getByRole("menu", { name: "Shapes", exact: true }).waitFor();
            const diamond = page.getByRole("menuitemradio", { name: /Diamond/ });
            if (mobile) await diamond.tap();
            else await diamond.click();
            await page
                .getByRole("menu", { name: "Shapes", exact: true })
                .waitFor({ state: "hidden" });
            assert.match(await shapes.getAttribute("title"), /Diamond/);
            const blocks = toolbar.getByRole("button", { name: "Blocks", exact: true });
            if (mobile) await blocks.tap();
            else await blocks.click();
            const menu = page.getByRole("menu", { name: "Blocks", exact: true });
            await menu.waitFor();
            const bounds = await menu.boundingBox();
            assert(
                bounds.x >= 0 &&
                    bounds.y >= 0 &&
                    bounds.x + bounds.width <= width + 1 &&
                    bounds.y + bounds.height <= height + 1,
                `${engine}/${name}: menu clipped`
            );
            assert.equal(await menu.getByRole("menuitem").count(), 8);
            await page.screenshot({ path: join(evidence, `${engine}-${name}-blocks.png`) });
            await page.keyboard.press("Escape");
            await menu.waitFor({ state: "hidden" });
            assert.deepEqual(errors, [], `${engine}/${name}: JS errors`);
            results.push({ engine, name, width, height, mobile, dock: rect, menu: bounds, errors });
            console.log(`PASS ${engine}/${name}`);
            await context.close();
        }
    } finally {
        await browser.close();
    }
}
await writeFile(join(evidence, "results.json"), JSON.stringify(results, null, 2));
console.log(`PASS ${results.length} browser/viewport combinations`);
