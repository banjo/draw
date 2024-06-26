import { Response as IResponse } from "express";
import { CoreResponse, CoreResponseError, CoreResponseMetadata, CoreResponseSuccess } from "common";

type BaseProps = {
    res: IResponse;
    cookie?: string;
    meta?: CoreResponseMetadata;
};

type SuccessProps<T> = BaseProps & {
    data?: T;
};

const success = <T>({
    res,
    data,
    cookie,
    meta,
}: SuccessProps<T>): IResponse<CoreResponseSuccess<T>> => {
    if (cookie) {
        res.setHeader("Set-Cookie", cookie);
    }

    if (!data) {
        return res.status(200).end();
    }

    return res.status(200).json(CoreResponse.success(data, meta));
};

type ErrorProps = BaseProps & {
    message: string;
    status?: number;
    errorCode?: number;
};

const error = ({
    res,
    message,
    status = 500,
    cookie,
    errorCode,
}: ErrorProps): IResponse<CoreResponseError> => {
    if (cookie) {
        res.setHeader("Set-Cookie", cookie);
    }

    return res.status(status).json(CoreResponse.error(message, errorCode));
};

const badRequest = ({
    res,
    message,
    cookie,
    errorCode,
}: ErrorProps): IResponse<CoreResponseError> =>
    error({ res, message, status: 400, cookie, errorCode });

const unauthorized = ({
    res,
    message,
    cookie,
    errorCode,
}: ErrorProps): IResponse<CoreResponseError> =>
    error({ res, message, status: 401, cookie, errorCode });

const internalServerError = ({
    res,
    message,
    cookie,
    errorCode,
}: ErrorProps): IResponse<CoreResponseError> =>
    error({ res, message, status: 500, cookie, errorCode });

const notFound = ({ res, message, cookie, errorCode }: ErrorProps): IResponse<CoreResponseError> =>
    error({ res, message, status: 404, cookie, errorCode });

const forbidden = ({ res, message, cookie, errorCode }: ErrorProps): IResponse<CoreResponseError> =>
    error({ res, message, status: 403, cookie, errorCode });

type RedirectProps = {
    res: IResponse;
    url: string;
    cookie?: string;
};

const redirect = ({ res, url, cookie }: RedirectProps) => {
    if (cookie) {
        res.setHeader("Set-Cookie", cookie);
    }

    return res.redirect(url);
};

export const HttpResponse = {
    success,
    error,
    redirect,
    badRequest,
    unauthorized,
    internalServerError,
    notFound,
    forbidden,
};
