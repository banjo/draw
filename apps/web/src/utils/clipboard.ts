/** Returns whether the text was copied. Browsers can refuse, e.g. without focus. */
export const copyToClipboard = async (text: string) => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
};
