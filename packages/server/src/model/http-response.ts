import { Response as IResponse } from "express";
import { CoreResponse, CoreResponseError, CoreResponseMetadata, CoreResponseSuccess } from "common";
import ck from "cookie";

type BaseProps = {
    res: IResponse;
    cookies?: string[];
    meta?: CoreResponseMetadata;
};

type SuccessProps<T> = BaseProps & {
    data?: T;
};

const success = <T>({
    res,
    data,
    cookies,
    meta,
}: SuccessProps<T>): IResponse<CoreResponseSuccess<T>> => {
    if (cookies) {
        res.setHeader("Set-Cookie", cookies);
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
    cookies,
    errorCode,
}: ErrorProps): IResponse<CoreResponseError> => {
    if (cookies) {
        res.setHeader("Set-Cookie", cookies);
    }

    return res.status(status).json(CoreResponse.error(message, errorCode));
};

const badRequest = ({
    res,
    message,
    cookies,
    errorCode,
}: ErrorProps): IResponse<CoreResponseError> =>
    error({ res, message, status: 400, cookies, errorCode });

const unauthorized = ({
    res,
    message,
    cookies,
    errorCode,
}: ErrorProps): IResponse<CoreResponseError> =>
    error({ res, message, status: 401, cookies, errorCode });

const internalServerError = ({
    res,
    message,
    cookies,
    errorCode,
}: ErrorProps): IResponse<CoreResponseError> =>
    error({ res, message, status: 500, cookies, errorCode });

const notFound = ({ res, message, cookies, errorCode }: ErrorProps): IResponse<CoreResponseError> =>
    error({ res, message, status: 404, cookies, errorCode });

const forbidden = ({
    res,
    message,
    cookies,
    errorCode,
}: ErrorProps): IResponse<CoreResponseError> =>
    error({ res, message, status: 403, cookies, errorCode });

type RedirectProps = {
    res: IResponse;
    url: string;
    cookies?: string[];
};

const redirect = ({ res, url, cookies }: RedirectProps) => {
    if (cookies) {
        res.setHeader("Set-Cookie", cookies);
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
