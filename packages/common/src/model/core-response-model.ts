export type CoreResponseMetadata = Record<string, unknown>;

export type CoreResponseSuccess<T> = {
    success: true;
    data: T;
    meta?: CoreResponseMetadata;
};

export type CoreResponseError = {
    success: false;
    message: string;
    errorCode?: number;
    meta?: CoreResponseMetadata;
};

export type CoreResponse<T> = CoreResponseSuccess<T> | CoreResponseError;

const success = <T>(data: T, meta?: CoreResponseMetadata): CoreResponseSuccess<T> => ({
    success: true,
    data,
    meta,
});

const error = (message: string, errorCode?: number): CoreResponseError => ({
    success: false,
    message,
    errorCode,
});

export const CoreResponse = {
    success,
    error,
};
