import { ErrorResult, ErrorStatus, ErrorType, SuccessResult } from "model";

export const Result = {
    ok: <T>(data: T): SuccessResult<T> => ({
        success: true,
        data,
    }),
    okEmpty: (): SuccessResult<void> => ({
        success: true,
        data: undefined,
    }),
    error: (message: string, type: ErrorType): ErrorResult => ({
        success: false,
        type,
        message,
        status: ErrorStatus[type],
    }),
};
