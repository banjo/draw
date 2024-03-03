import { z } from "zod";

export const SlugSchema = z.string().uuid();

export type Slug = z.infer<typeof SlugSchema>;
