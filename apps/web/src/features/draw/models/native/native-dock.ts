import { NativeSlot } from "./native-slot";

/** Phones render neither the desktop footer nor its UI wrapper, so the dock lives in the
 * editor root and is placed with CSS on a computer, above the bottom bar on a phone. */
export const NativeDock = new NativeSlot("custom-dock", ".excalidraw", "last");
