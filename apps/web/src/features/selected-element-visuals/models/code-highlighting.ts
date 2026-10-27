import { refractor } from "refractor/lib/core.js";
import batch from "refractor/lang/batch.js";
import coffeescript from "refractor/lang/coffeescript.js";
import cpp from "refractor/lang/cpp.js";
import csharp from "refractor/lang/csharp.js";
import cshtml from "refractor/lang/cshtml.js";
import css from "refractor/lang/css.js";
import diff from "refractor/lang/diff.js";
import fsharp from "refractor/lang/fsharp.js";
import handlebars from "refractor/lang/handlebars.js";
import java from "refractor/lang/java.js";
import javascript from "refractor/lang/javascript.js";
import json from "refractor/lang/json.js";
import less from "refractor/lang/less.js";
import lua from "refractor/lang/lua.js";
import markdown from "refractor/lang/markdown.js";
import markup from "refractor/lang/markup.js";
import objectivec from "refractor/lang/objectivec.js";
import php from "refractor/lang/php.js";
import powershell from "refractor/lang/powershell.js";
import pug from "refractor/lang/pug.js";
import python from "refractor/lang/python.js";
import r from "refractor/lang/r.js";
import ruby from "refractor/lang/ruby.js";
import sass from "refractor/lang/sass.js";
import scss from "refractor/lang/scss.js";
import typescript from "refractor/lang/typescript.js";
import visualBasic from "refractor/lang/visual-basic.js";
import type { TextareaCodeEditorProps } from "@uiw/react-textarea-code-editor/nohighlight";
import rehypePrismGenerator from "rehype-prism-plus/generator";
import { CodeEditorLanguage } from "./code-editor-langauges";

// Only the languages in CODE_EDITOR_LANGUAGES, instead of all of Prism's
[
    batch,
    coffeescript,
    cpp,
    csharp,
    cshtml,
    css,
    diff,
    fsharp,
    handlebars,
    java,
    javascript,
    json,
    less,
    lua,
    markdown,
    markup,
    objectivec,
    php,
    powershell,
    pug,
    python,
    r,
    ruby,
    sass,
    scss,
    typescript,
    visualBasic,
].forEach(language => refractor.register(language));

export const codeHighlightPlugins: NonNullable<TextareaCodeEditorProps["rehypePlugins"]> = [
    // The editor's types use an older unified, but it's the plugin its default entry uses
    [rehypePrismGenerator(refractor) as never, { ignoreMissing: true }],
];

/** Names that aren't Prism's ids or aliases */
const PRISM_NAMES: Partial<Record<CodeEditorLanguage, string>> = {
    "C#": "csharp",
    "C++": "cpp",
    "F#": "fsharp",
    "Objective-C": "objectivec",
};

export const toPrismLanguage = (language: CodeEditorLanguage) =>
    PRISM_NAMES[language] ?? language.toLowerCase();
