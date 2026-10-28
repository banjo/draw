import { z } from "zod";

/** The colors a folder can have, from Excalidraw's palette */
export const FOLDER_COLORS = [
    "#4c6ef5",
    "#7950f2",
    "#be4bdb",
    "#e64980",
    "#e03131",
    "#f76707",
    "#f59f00",
    "#37b24d",
    "#12b886",
    "#1c7ed6",
    "#868e96",
] as const;

export const FolderColorSchema = z.enum(FOLDER_COLORS);
export type FolderColor = z.infer<typeof FolderColorSchema>;

export const FolderNameSchema = z.string().trim().min(1).max(100);

export const FolderIdSchema = z.number().int().positive();

export const MAX_FOLDERS = 500;
