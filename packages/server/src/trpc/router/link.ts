import { z } from "zod";
import { LinkPreviewService } from "../../services/link-preview-service";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const linkRouter = createTRPCRouter({
    /** A page's title, description and icon, for a link card. Public, as offline drawings have them too. */
    preview: publicProcedure
        .input(
            z.object({
                url: z
                    .string()
                    .url()
                    .max(2048)
                    .regex(/^https?:\/\//i),
            })
        )
        .query(({ input }) => LinkPreviewService.getPreview(input.url)),
});
