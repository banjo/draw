import { Maybe } from "@banjoanton/utils";

type CustomElementType = "default" | "codeblock";

type CustomDataBase = {
    /**
     * Whether it is a shadow element.
     */
    shadow: boolean;
    /**
     * The type of the custom element.
     */
    type: CustomElementType;
};

type CustomDataDefault = CustomDataBase & {
    type: "default";
};

type CustomDataCodeblock = CustomDataBase & {
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

export const CustomData = {
    createDefault: ({ shadow }: Props): CustomDataDefault => ({
        shadow,
        type: "default",
    }),
    createCodeblock: ({ code, shadow }: CodeBlockProps): CustomDataCodeblock => ({
        shadow,
        type: "codeblock",
        code,
    }),
    updateDefault: (current: Maybe<CustomData>, props: Props): CustomDataDefault => {
        if (!current) {
            return CustomData.createDefault(props);
        }
        return {
            ...current,
            shadow: props.shadow,
            type: "default",
        };
    },
};
