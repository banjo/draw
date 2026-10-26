import { Maybe } from "@banjoanton/utils";
import { CustomData, CustomDataCodeblock } from "common";

export const CODE_EDITOR_LANGUAGES = [
    "TypeScript",
    "JavaScript",
    "CSS",
    "LESS",
    "SCSS",
    "JSON",
    "HTML",
    "XML",
    "PHP",
    "C#",
    "C++",
    "Razor",
    "Markdown",
    "Diff",
    "Java",
    "VB",
    "CoffeeScript",
    "Handlebars",
    "Batch",
    "Pug",
    "F#",
    "Lua",
    "Powershell",
    "Python",
    "Ruby",
    "SASS",
    "R",
    "Objective-C",
] as const;

export const DEFAULT_CODE_EDITOR_LANGUAGE = "JavaScript" as const;

export type CodeEditorLanguage = (typeof CODE_EDITOR_LANGUAGES)[number];

export const DEFAULT_CODE_EDITOR_FONT_SIZE = 14;

const isCodeEditorLanguage = (language: unknown): language is CodeEditorLanguage =>
    CODE_EDITOR_LANGUAGES.includes(language as CodeEditorLanguage);

/** The language and font size of a code block, stored on the element. */
export const getCodeBlockSettings = (customData: Maybe<CustomData>) => {
    const codeblock = customData as Maybe<CustomDataCodeblock>;
    const language = codeblock?.language;

    return {
        language: isCodeEditorLanguage(language) ? language : DEFAULT_CODE_EDITOR_LANGUAGE,
        fontSize: codeblock?.fontSize ?? DEFAULT_CODE_EDITOR_FONT_SIZE,
    };
};
