import { Maybe } from "@banjoanton/utils";
import { TRPCClientError } from "@trpc/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const causes = ["EXPIRED_TOKEN", "NOT_OWNER", "DRAWING_NOT_FOUND"] as const;
export type Cause = (typeof causes)[number];

const select: Record<Cause, Cause> = causes.reduce(
    (acc, cause) => ({ ...acc, [cause]: cause }),
    {} as Record<Cause, Cause>
);

const schema = z.enum(causes);

const fromServerError = (error: TRPCError): Maybe<Cause> => {
    const res = schema.safeParse(error.cause?.message);
    return res.success ? res.data : undefined;
};

const fromClientError = (error: TRPCClientError<any>): Maybe<Cause> => {
    const res = schema.safeParse(error?.shape?.cause);
    return res.success ? res.data : undefined;
};

export const Cause = {
    fromServerError,
    fromClientError,
    ...select,
};
