/** Whether `folderId` is `ancestorId` or inside it, given each folder's parent */
export const isWithin = (
    folderId: number,
    ancestorId: number,
    parents: Map<number, number | null>
): boolean => {
    const seen = new Set<number>();
    for (let id: number | null | undefined = folderId; id; id = parents.get(id)) {
        if (id === ancestorId) return true;
        // A loop in stored data shouldn't hang the request
        if (seen.has(id)) return false;
        seen.add(id);
    }
    return false;
};
