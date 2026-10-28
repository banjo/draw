const MINUTE = 60_000;

/** "12 min", "5 h", "Yesterday", "3 days", "2 wk", then the date. With `ago`: "12 min ago". */
export const formatAge = (date: Date, { ago = false } = {}) => {
    const now = new Date();
    const withAgo = (text: string) => (ago ? `${text} ago` : text);

    const minutes = Math.max(0, Math.round((now.getTime() - date.getTime()) / MINUTE));
    if (minutes < 1) return "Just now";
    if (minutes < 60) return withAgo(`${minutes} min`);

    const hours = Math.round(minutes / 60);
    if (hours < 24) return withAgo(`${hours} h`);

    const days = Math.round(hours / 24);
    if (days < 2) return "Yesterday";
    if (days < 7) return withAgo(`${days} days`);

    const weeks = Math.round(days / 7);
    if (weeks < 5) return withAgo(`${weeks} wk`);

    return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
    });
};
