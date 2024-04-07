import { defaults, Maybe } from "@banjoanton/utils";

export type CustomElementType = "rectangle" | "ellipse" | "diamond" | "arrow" | "codeblock";

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
};

export type CustomData = CustomDataDefault | CustomDataCodeblock;

type Props = {
    shadow: boolean;
};

type CodeBlockProps = Props & {
    code: string;
};

const defaultCustomData: CustomDataDefault = {
    shadow: false,
    type: "rectangle",
};

const defaultCustomDataCodeblock: CustomDataCodeblock = {
    shadow: false,
    type: "codeblock",
    code: "",
};

export const CustomData = {
    createDefault: (props: BaseCustomData): CustomDataDefault => ({
        ...props,
    }),
    createCodeblock: (props: CodeBlockProps): CustomDataCodeblock => ({
        ...props,
        type: "codeblock",
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
            code: "",
            ...current,
            ...props,
            type: "codeblock",
        };
    },
};
