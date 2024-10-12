import { createResultWithErrorData } from "@banjoanton/utils";

type ResultErrorMap = {
    Unauthorized: undefined;
};

type DefaultError = "DefaultError";

export const Result = createResultWithErrorData<ResultErrorMap, DefaultError>();
