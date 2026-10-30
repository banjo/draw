import { DrawingAccess, DrawingRole } from "common";
import { create } from "zustand";

type DrawingAccessStore = {
    /** Your role on the open drawing, unknown while it loads */
    role?: DrawingRole;
    setRole: (role?: DrawingRole) => void;
};

export const useDrawingAccessStore = create<DrawingAccessStore>(set => ({
    role: undefined,
    setRole: role => set({ role }),
}));

/** Whether you can change the open drawing, for code outside React */
export const canEditDrawing = () => {
    const { role } = useDrawingAccessStore.getState();
    return role !== undefined && DrawingAccess.canEdit(role);
};
