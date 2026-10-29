import handUrl from "../assets/excalifont-latin.woff2?url";
import sansItalicUrl from "@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-italic.woff2?url";
import sansUrl from "@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-normal.woff2?url";

/**
 * A note's image has its fonts inside it, as images can't use the page's fonts. Text is
 * measured with the same files, so a note is laid out the same in every browser.
 * Excalifont is Excalidraw's Latin part of it (`assets/`), Hanken Grotesk the app's own.
 */
export const NOTE_FONTS = {
    sans: "BanjoNoteSans",
    hand: "BanjoNoteHand",
    mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
};

export type NoteFontFiles = { sans: string; sansItalic: string; hand: string };

const toDataUrl = async (url: string) => {
    const blob = await (await fetch(url)).blob();
    return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(new Blob([blob], { type: "font/woff2" }));
    });
};

let loading: Promise<NoteFontFiles> | undefined;

const load = async (): Promise<NoteFontFiles> => {
    const [sans, sansItalic, hand] = await Promise.all([
        toDataUrl(sansUrl),
        toDataUrl(sansItalicUrl),
        toDataUrl(handUrl),
    ]);
    const faces = [
        new FontFace(NOTE_FONTS.sans, `url(${sans})`, { weight: "100 900" }),
        new FontFace(NOTE_FONTS.sans, `url(${sansItalic})`, { weight: "100 900", style: "italic" }),
        new FontFace(NOTE_FONTS.hand, `url(${hand})`),
    ];
    await Promise.all(faces.map(face => face.load()));
    faces.forEach(face => document.fonts.add(face));
    return { sans, sansItalic, hand };
};

/** The fonts as data URLs, loaded into the page once to measure text with */
export const loadNoteFonts = () => {
    if (!loading) {
        const started = load();
        // Tried again next time, e.g. after being offline
        started.catch(() => (loading = undefined));
        loading = started;
    }
    return loading;
};
