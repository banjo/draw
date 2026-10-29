import handUrl from "../assets/excalifont-latin.woff2?url";
import sansItalicUrl from "@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-italic.woff2?url";
import sansUrl from "@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-normal.woff2?url";

/**
 * The images of notes and tables have their fonts inside them, as images can't use the
 * page's fonts. Text is measured with the same files, so they're laid out the same in every
 * browser. Excalifont is Excalidraw's Latin part of it (`assets/`), Hanken Grotesk the app's
 * own.
 */
export const BLOCK_FONTS = {
    sans: "BanjoBlockSans",
    hand: "BanjoBlockHand",
    mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
};

export type BlockFontFiles = { sans: string; sansItalic: string; hand: string };

const toDataUrl = async (url: string) => {
    const blob = await (await fetch(url)).blob();
    return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(new Blob([blob], { type: "font/woff2" }));
    });
};

let loading: Promise<BlockFontFiles> | undefined;

const load = async (): Promise<BlockFontFiles> => {
    const [sans, sansItalic, hand] = await Promise.all([
        toDataUrl(sansUrl),
        toDataUrl(sansItalicUrl),
        toDataUrl(handUrl),
    ]);
    const faces = [
        new FontFace(BLOCK_FONTS.sans, `url(${sans})`, { weight: "100 900" }),
        new FontFace(BLOCK_FONTS.sans, `url(${sansItalic})`, {
            weight: "100 900",
            style: "italic",
        }),
        new FontFace(BLOCK_FONTS.hand, `url(${hand})`),
    ];
    await Promise.all(faces.map(face => face.load()));
    faces.forEach(face => document.fonts.add(face));
    return { sans, sansItalic, hand };
};

/** The fonts as data URLs, loaded into the page once to measure text with */
export const loadBlockFonts = () => {
    if (!loading) {
        const started = load();
        // Tried again next time, e.g. after being offline
        started.catch(() => (loading = undefined));
        loading = started;
    }
    return loading;
};

/** The @font-face rules for an image's <style>, only the fonts it uses */
export const getFontFaces = (
    fonts: BlockFontFiles,
    used: { sans?: boolean; sansItalic?: boolean; hand?: boolean }
) =>
    [
        used.sans &&
            `@font-face{font-family:${BLOCK_FONTS.sans};src:url(${fonts.sans}) format("woff2");font-weight:100 900}`,
        used.sansItalic &&
            `@font-face{font-family:${BLOCK_FONTS.sans};src:url(${fonts.sansItalic}) format("woff2");font-weight:100 900;font-style:italic}`,
        used.hand &&
            `@font-face{font-family:${BLOCK_FONTS.hand};src:url(${fonts.hand}) format("woff2")}`,
    ]
        .filter(Boolean)
        .join("");
