import { createDeepSeek } from "@ai-sdk/deepseek";
import { generateText, Output } from "ai";
import {
    AiDiagramInput,
    AiDiagramResult,
    AiMermaidInput,
    AiMermaidResult,
    DIAGRAM_FORMAT_GUIDE,
    DiagramSpec,
    DiagramSpecUtil,
    Env,
} from "common";
import { z } from "zod";
import { createContextLogger } from "../lib/context-logger";

const logger = createContextLogger("ai-service");
const env = Env.server();

// DeepSeek gets the JSON schema in its instructions, which the AI SDK warns about each time
(globalThis as { AI_SDK_LOG_WARNINGS?: boolean }).AI_SDK_LOG_WARNINGS = false;

const DEFAULT_MODEL = "deepseek-flash";
const TIMEOUT = 90_000;

const getModel = () => {
    if (!env.DEEPSEEK_API_KEY) return undefined;
    const deepseek = createDeepSeek({ apiKey: env.DEEPSEEK_API_KEY });
    return deepseek(env.AI_MODEL ?? DEFAULT_MODEL);
};

const isEnabled = () => Boolean(env.DEEPSEEK_API_KEY);

const LANGUAGE_RULE =
    "Write labels and the summary in the language of the request (English if unsure).";

const DIAGRAM_SYSTEM = `You design diagrams for BanjoDraw, a whiteboard app built on Excalidraw. You answer with JSON describing the diagram; the app draws it, lays it out automatically and connects the arrows. You never give positions or sizes.

${DIAGRAM_FORMAT_GUIDE}

Guidelines:
- Make the diagram the user asks for, complete but uncluttered: usually 3 to 25 nodes, more only when asked.
- Pick the node type that fits the content: shapes and arrows for structure and flow, blocks (note, table, chart, code, sticky, link) for content that would not fit in a short label.
- Ids are short and readable, like "api" or "check-login", and unique among nodes and groups.
- Every edge goes from and to node ids. Don't connect to groups.
- When you get a current diagram, change it as asked and return the whole diagram: keep the ids, types and content of everything the request doesn't touch.
- When you get a Mermaid diagram, turn it into nodes and edges with the same meaning.
- summary: one short sentence on what you made or changed, like "Added a cache between the API and the database."
- ${LANGUAGE_RULE}`;

const MERMAID_SYSTEM = `You write Mermaid diagrams (Mermaid 11) for BanjoDraw, a whiteboard app. You answer with JSON: the Mermaid definition and a summary.

Rules:
- Pick the diagram type that fits: flowchart, sequenceDiagram, classDiagram, erDiagram, stateDiagram-v2, gantt, pie, mindmap, timeline, journey, quadrantChart, gitGraph or xychart-beta.
- The definition must be valid Mermaid that renders as is: no Markdown code fences, no %%{init}%% directives, no click handlers or HTML. Quote labels that contain special characters, like A["Label (with parens)"].
- Keep it readable: usually 3 to 25 nodes, short labels.
- When you get a current diagram, change it as asked and keep everything the request doesn't touch.
- When you get a BanjoDraw diagram as JSON, turn it into Mermaid with the same meaning.
- When you get a diagram Mermaid couldn't read and the error, fix the syntax and keep the meaning.
- summary: one short sentence on what you made or changed.
- ${LANGUAGE_RULE}`;

const DiagramOutput = z.object({ summary: z.string().max(500), diagram: DiagramSpec });
const MermaidOutput = z.object({ summary: z.string().max(500), definition: z.string() });

const json = (value: unknown) => JSON.stringify(value);

const ask = async <T>(system: string, prompt: string, schema: z.ZodType<T>): Promise<T> => {
    const model = getModel();
    if (!model) throw new Error("AI is turned off");

    const started = Date.now();
    const { output, usage } = await generateText({
        model,
        system,
        prompt,
        output: Output.object({ schema }),
        // Thinking makes it slower, and these answers don't need it
        providerOptions: { deepseek: { thinking: { type: "disabled" } } },
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(TIMEOUT),
    });
    logger.info(
        { ms: Date.now() - started, input: usage.inputTokens, output: usage.outputTokens },
        "AI answered"
    );
    return output;
};

const createDiagram = async (input: AiDiagramInput): Promise<AiDiagramResult> => {
    const parts = [`Request: ${input.prompt}`];
    if (input.current) parts.push(`Current diagram, to change: ${json(input.current)}`);
    if (input.mermaid) parts.push(`Mermaid diagram, to turn into nodes:\n${input.mermaid}`);

    const output = await ask(DIAGRAM_SYSTEM, parts.join("\n\n"), DiagramOutput);
    return { summary: output.summary, diagram: DiagramSpecUtil.clean(output.diagram) };
};

/** Without the ```mermaid fences models sometimes add anyway */
const unfence = (definition: string) =>
    definition
        .trim()
        .replace(/^```(?:mermaid)?\s*\n/i, "")
        .replace(/\n?```\s*$/, "")
        .trim();

const createMermaid = async (input: AiMermaidInput): Promise<AiMermaidResult> => {
    const parts = [`Request: ${input.prompt}`];
    if (input.current) parts.push(`Current diagram, to change:\n${input.current}`);
    if (input.diagram)
        parts.push(`BanjoDraw diagram, to turn into Mermaid: ${json(input.diagram)}`);
    if (input.fix) {
        parts.push(
            `Mermaid couldn't read this diagram:\n${input.fix.definition}\n\nThe error: ${input.fix.error}`
        );
    }

    const output = await ask(MERMAID_SYSTEM, parts.join("\n\n"), MermaidOutput);
    return { summary: output.summary, definition: unfence(output.definition) };
};

export const AiService = { isEnabled, createDiagram, createMermaid };
