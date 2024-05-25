import { defaults, Maybe } from "@banjoanton/utils";

export type CustomElementType =
    | "rectangle"
    | "ellipse"
    | "diamond"
    | "text"
    | "arrow"
    | "line"
    | "codeblock"
    | "image"
    | "model";

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
};

export type CustomDataModel = BaseCustomData & {
    type: "model";
    currentHeight: number;
    textElementCount: number;
};

export type CustomData = CustomDataDefault | CustomDataCodeblock | CustomDataModel;

type Props = {
    shadow: boolean;
};

type CodeBlockProps = Props & {
    code: string;
    language: string;
};

type ModelProps = Props & {
    currentHeight: number;
    textElementCount: number;
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
};

const defaultCustomDataModel: CustomDataModel = {
    shadow: false,
    type: "model",
    currentHeight: 0,
    textElementCount: 0,
};

export const CustomData = {
    createDefault: (props: BaseCustomData): CustomDataDefault => ({
        ...props,
    }),
    createCodeblock: (props: CodeBlockProps): CustomDataCodeblock => ({
        ...props,
        ...defaultCustomDataCodeblock,
    }),
    createModel: (props: ModelProps): CustomDataModel => ({
        ...props,
        ...defaultCustomDataModel,
    }),
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
