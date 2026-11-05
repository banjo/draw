const ID_ALPHABET = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";

/** An element id like Excalidraw's: 21 URL-safe characters */
const id = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(21));
    return Array.from(bytes, byte => ID_ALPHABET[byte & 63]).join("");
};

/** A seed or version nonce, as Excalidraw makes them */
const integer = () => Math.floor(Math.random() * 2 ** 31);

export const Random = { id, integer };
