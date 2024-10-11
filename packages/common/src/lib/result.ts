import { createResult } from "@banjoanton/utils";

type ResultErrorMap = {
    Unauthorized: undefined;
};

type DefaultError = "DefaultError";

export const Result = createResult<ResultErrorMap, DefaultError>();
