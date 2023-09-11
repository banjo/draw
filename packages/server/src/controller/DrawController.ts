import { createHonoInstance } from "..";

export const drawController = createHonoInstance();

const getDraw = drawController.get("/draw", async c => {
    return c.jsonT({ hello: "world" });
});
type GetDrawRoute = typeof getDraw;

const saveDrawing = drawController.post("/draw", async c => {
    return c.jsonT({ hello: "world" });
});
type SaveDrawingRoute = typeof saveDrawing;

export type DrawController = GetDrawRoute | SaveDrawingRoute;
