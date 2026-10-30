import { trpc } from "@/lib/trpc";
import { isDefined } from "@banjoanton/utils";
import { DrawingAccess, DrawingRole } from "common";
import { useLayoutEffect } from "react";
import { useDrawingAccessStore } from "../stores/use-drawing-access-store";

/**
 * Your role on the drawing, kept in a store for code outside React. The offline drawing is
 * always yours. While a saved drawing loads, the role is unknown and it can't be changed.
 */
export const useDrawingAccess = (slug?: string) => {
    const { data } = trpc.access.get.useQuery(
        { slug: slug ?? "" },
        // Not found or no access shows from the drawing's own subscription
        { enabled: isDefined(slug), retry: false }
    );
    const role: DrawingRole | undefined = slug ? data?.role : "owner";
    const setRole = useDrawingAccessStore(s => s.setRole);

    useLayoutEffect(() => {
        setRole(role);
    }, [role, setRole]);

    return {
        role,
        canEdit: role !== undefined && DrawingAccess.canEdit(role),
    };
};
