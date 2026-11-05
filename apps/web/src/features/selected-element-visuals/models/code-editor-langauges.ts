import { Maybe } from "@banjoanton/utils";
import { BlockContent, CustomData } from "common";

export {
    CODE_EDITOR_LANGUAGES,
    DEFAULT_CODE_EDITOR_FONT_SIZE,
    DEFAULT_CODE_EDITOR_LANGUAGE,
} from "common";
export type { CodeEditorLanguage } from "common";

/** The language and font size of a code block, stored on the element. */
export const getCodeBlockSettings = (customData: Maybe<CustomData>) =>
    BlockContent.getCodeBlockSettings(customData);
