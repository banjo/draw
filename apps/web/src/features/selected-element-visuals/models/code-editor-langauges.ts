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
