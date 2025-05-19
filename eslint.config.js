import defaultConfig from "@banjoanton/eslint-config";

/** @type {import("eslint").Linter.Config} */
export default [
    ...defaultConfig,
    {
        rules: {
            "react/forbid-component-props": "off",
        },
    },
];
