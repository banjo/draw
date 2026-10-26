import { z } from "zod";

/** Slugs of new drawings are random UUIDs, so a link can't be guessed. */
export const SlugSchema = z.string().uuid();

/** Finding a drawing also accepts older slugs that may not be UUIDs. */
export const ExistingSlugSchema = z.string().min(1).max(100);

export type Slug = z.infer<typeof ExistingSlugSchema>;
