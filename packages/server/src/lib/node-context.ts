import { Maybe, uuid } from "@banjoanton/utils";
import { AsyncLocalStorage } from "node:async_hooks";
import { NextFunction, Request, Response } from "express";

type StoreContext = {
    requestId: Maybe<string>;
    userId: Maybe<number>;
    isWS: Maybe<boolean>;
};

const context = new AsyncLocalStorage<StoreContext>();

const setStoreValue = <K extends keyof StoreContext>(key: K, value: StoreContext[K]): void => {
    const store = context.getStore();
    if (!store) return;
    store[key] = value;
};

const getRequestId = () => context.getStore()?.requestId;
const setRequestId = (requestId: string) => setStoreValue("requestId", requestId);

const getUserId = (): Maybe<number> => context.getStore()?.userId;
const setUserId = (userId: number) => setStoreValue("userId", userId);

const getIsWS = () => context.getStore()?.isWS;
const setIsWS = (isWebSocket: boolean) => setStoreValue("isWS", isWebSocket);

/** Run with a new context, so concurrent requests don't share ids in the logs. */
const run = <T>(values: Partial<StoreContext>, fn: () => T): T =>
    context.run({ requestId: uuid(), userId: undefined, isWS: undefined, ...values }, fn);

const setupExpressContext = (_req: Request, _res: Response, next: NextFunction) => {
    run({ isWS: false }, () => next());
};

const exists = () => context.getStore() !== undefined;

export const NodeContext = {
    setupExpressContext,
    getRequestId,
    getUserId,
    setUserId,
    setRequestId,
    getIsWS,
    setIsWS,
    run,
    exists,
};
