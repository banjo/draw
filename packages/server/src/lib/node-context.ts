import { uuid } from "@banjoanton/utils";
import { createNamespace } from "cls-hooked";

const NAME = "request-context";
const namespace = createNamespace(NAME);

const REQUEST_ID_NAME = "requestId";
const getRequestId = () => namespace.get(REQUEST_ID_NAME);
const setRequestId = (requestId: string) => namespace.set(REQUEST_ID_NAME, requestId);

const USER_ID_NAME = "userId";
const getUserId = (): number => namespace.get(USER_ID_NAME);
const setUserId = (userId: number) => namespace.set(USER_ID_NAME, userId);

// @ts-ignore
const setupContext = (req, res, next) => {
    namespace.run(() => {
        const requestId = uuid();
        setRequestId(requestId);
        next();
    });
};

export const NodeContext = {
    setupContext,
    getRequestId,
    getUserId,
    setUserId,
};
