import pino from "pino";
import { NodeContext } from "./node-context";
import { invariant } from "@banjoanton/utils";
import { createLogger, Env } from "common";

const getNamespace = () => ({
    requestId: NodeContext.getRequestId(),
    userId: NodeContext.getUserId(),
});

type LogFnWithString = (msg: string, ...args: unknown[]) => void;
type LogFnWithObject = (obj: object, msg: string, ...args: unknown[]) => void;
type LogFn = LogFnWithString & LogFnWithObject;

interface ILogger {
    trace: LogFn;
    debug: LogFn;
    info: LogFn;
    warn: LogFn;
    error: LogFn;
    fatal: LogFn;
}

class ContextLogger implements ILogger {
    private logger: pino.Logger;

    constructor(name: string) {
        this.logger = createLogger(name);
    }

    private handle(level: pino.Level, objOrMsg: object | string, ...args: unknown[]) {
        const namespace = getNamespace();

        if (typeof objOrMsg === "string") {
            this.logger[level]({ ...namespace, ...args }, objOrMsg);
            return;
        }

        const [msg, ...restArgs] = args;
        invariant(typeof msg === "string", "Expected message to be a string");
        this.logger[level]({ ...objOrMsg, ...namespace, ...restArgs }, msg);
    }

    public trace(obj: object, msg?: string, ...args: unknown[]): void;
    public trace(msg: string, ...args: unknown[]): void;
    public trace(objOrMsg: object | string, ...args: unknown[]): void {
        this.handle("trace", objOrMsg, ...args);
    }

    public debug(obj: object, msg?: string, ...args: unknown[]): void;
    public debug(msg: string, ...args: unknown[]): void;
    public debug(objOrMsg: object | string, ...args: unknown[]): void {
        this.handle("debug", objOrMsg, ...args);
    }

    public info(obj: object, msg?: string, ...args: unknown[]): void;
    public info(msg: string, ...args: unknown[]): void;
    public info(objOrMsg: object | string, ...args: unknown[]): void {
        this.handle("info", objOrMsg, ...args);
    }

    public warn(obj: object, msg?: string, ...args: unknown[]): void;
    public warn(msg: string, ...args: unknown[]): void;
    public warn(objOrMsg: object | string, ...args: unknown[]): void {
        this.handle("warn", objOrMsg, ...args);
    }

    public error(obj: object, msg?: string, ...args: unknown[]): void;
    public error(msg: string, ...args: unknown[]): void;
    public error(objOrMsg: object | string, ...args: unknown[]): void {
        this.handle("error", objOrMsg, ...args);
    }

    public fatal(obj: object, msg?: string, ...args: unknown[]): void;
    public fatal(msg: string, ...args: unknown[]): void;
    public fatal(objOrMsg: object | string, ...args: unknown[]): void {
        this.handle("fatal", objOrMsg, ...args);
    }
}

export const createContextLogger = (name: string): ILogger => new ContextLogger(name);

export const startupLog = (name: string) => {
    const logger = createLogger("startup");
    const env = Env.server();
    const message = `🚀 Starting up ${name}
🖥️ Environment: ${env.NODE_ENV}
📝 Log level: ${env.LOG_LEVEL}
🚪 Port: ${env.PORT}
🔗 Client URL: ${env.CLIENT_URL}`;

    logger.info(message);
};
