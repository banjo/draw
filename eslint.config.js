import ts from "@banjoanton/eslint-config/typescript";
import js from "@banjoanton/eslint-config/javascript";
import react from "@banjoanton/eslint-config/react";
//
// /** @type {import("eslint").Linter.Config} */
// export default [
//     ...defaultConfig,
// ];

export default [...ts, ...js, ...react];
