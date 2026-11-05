/** Excalidraw's string hash (djb2), so ids made from content are the same in the app and the API */
export const hashString = (text: string) => {
    let hash = 5381;
    for (let i = 0; i < text.length; i++) {
        hash = (hash << 5) + hash + text.charCodeAt(i);
    }
    return hash >>> 0;
};
