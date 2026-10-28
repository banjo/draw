import { createResultWithErrorData } from "@banjoanton/utils";

type ResultErrorMap = {
    Unauthorized: undefined;
    Conflict: undefined;
    NotFound: undefined;
    BadRequest: undefined;
};

type DefaultError = "DefaultError";

export const Result = createResultWithErrorData<ResultErrorMap, DefaultError>();
