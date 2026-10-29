import { defaults, Maybe } from "@banjoanton/utils";

export type ModelType = "model" | "model-child" | "model-line" | "model-title";

/** Shapes of BanjoDraw's own, drawn by Excalidraw as a rectangle or an ellipse */
export type CustomShapeType =
    | "circle"
    | "pill"
    | "triangle"
    | "hexagon"
    | "star"
    | "parallelogram"
    | "cylinder"
    | "document"
    | "cloud"
    | "sticky-note";

export type CustomElementType =
    | "rectangle"
    | "ellipse"
    | "diamond"
    | CustomShapeType
    | "text"
    | "arrow"
    | "line"
    | "codeblock"
    | "mermaid"
    | "image"
    | ModelType;

type BaseCustomData = {
    /**
     * Whether it is a shadow element.
     */
    shadow: boolean;
    /**
     * The type of the custom element.
     */
    type: CustomElementType;
};

export type CustomDataDefault = BaseCustomData;

export type CustomDataCodeblock = BaseCustomData & {
    type: "codeblock";
    code: string;
    language: string;
    fontSize: number;
};

export type CustomDataModel = BaseCustomData & {
    type: "model";
    currentHeight: number;
    textElementCount: number;
    groupId: string;
};

/** A Mermaid diagram, drawn as an image */
export type CustomDataMermaid = BaseCustomData & {
    type: "mermaid";
    definition: string;
};

export type CustomData =
    CustomDataDefault | CustomDataCodeblock | CustomDataModel | CustomDataMermaid;

type Props = {
    shadow: boolean;
};

type CodeBlockProps = Props & {
    code: string;
    language: string;
    fontSize: number;
};

type ModelProps = Props & {
    currentHeight: number;
    textElementCount: number;
    groupId: string;
};

const defaultCustomData: CustomDataDefault = {
    shadow: false,
    type: "rectangle",
};

const defaultCustomDataCodeblock: CustomDataCodeblock = {
    shadow: false,
    type: "codeblock",
    code: "",
    language: "javascript",
    fontSize: 14,
};

const defaultCustomDataModel: CustomDataModel = {
    shadow: false,
    type: "model",
    currentHeight: 0,
    textElementCount: 0,
    groupId: "",
};

export const CustomData = {
    parseModelData: (data: unknown): Maybe<CustomDataModel> => {
        if (!data || typeof data !== "object") {
            return undefined;
        }

        const { shadow, type, currentHeight, textElementCount, groupId } = data as CustomDataModel;

        if (
            typeof shadow !== "boolean" ||
            type !== "model" ||
            typeof currentHeight !== "number" ||
            typeof textElementCount !== "number" ||
            typeof groupId !== "string"
        ) {
            return undefined;
        }

        return {
            shadow,
            type,
            currentHeight,
            textElementCount,
            groupId,
        };
    },
    createDefault: (props: BaseCustomData): CustomDataDefault => ({
        ...props,
    }),
    createCodeblock: (props: CodeBlockProps): CustomDataCodeblock => ({
        ...defaultCustomDataCodeblock,
        ...props,
    }),
    createModel: (props: ModelProps): CustomDataModel => ({
        ...defaultCustomDataModel,
        ...props,
    }),
    createMermaid: (definition: string): CustomDataMermaid => ({
        shadow: false,
        type: "mermaid",
        definition,
    }),
    getMermaidDefinition: (data: unknown): Maybe<string> => {
        if (!data || typeof data !== "object") return undefined;
        const { type, definition } = data as CustomDataMermaid;
        return type === "mermaid" && typeof definition === "string" ? definition : undefined;
    },
    updateDefault: (
        current: Maybe<CustomData>,
        props: Partial<BaseCustomData>
    ): CustomDataDefault => {
        const allProps = defaults(props, defaultCustomData);

        if (!current) {
            return CustomData.createDefault(allProps);
        }
        return {
            ...current,
            ...props,
        };
    },
    updateCodeblock: (
        current: Maybe<CustomData>,
        props: Partial<CodeBlockProps>
    ): CustomDataCodeblock => {
        const allProps = defaults(props, defaultCustomDataCodeblock);

        if (!current) {
            return CustomData.createCodeblock(allProps);
        }
        return {
            ...defaultCustomDataCodeblock,
            ...current,
            ...props,
            type: "codeblock",
        };
    },
    updateModel: (current: Maybe<CustomData>, props: Partial<ModelProps>): CustomDataModel => {
        const allProps = defaults(props, defaultCustomDataModel);

        if (!current) {
            return CustomData.createModel(allProps);
        }

        return {
            ...defaultCustomDataModel,
            ...current,
            ...props,
            type: "model",
        };
    },
};
