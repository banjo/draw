import { Maybe } from "@banjoanton/utils";
import { z } from "zod";

export const causes = ["EXPIRED_TOKEN"] as const;
export type Cause = (typeof causes)[number];

const select: Record<Cause, Cause> = causes.reduce(
    (acc, cause) => ({ ...acc, [cause]: cause }),
    {} as Record<Cause, Cause>
);

const schema = z.enum(causes);

type ErrorWithCause = Error & { cause?: Error };

const from = (error: ErrorWithCause): Maybe<Cause> => {
    const res = schema.safeParse(error.cause?.message);

    if (res.success) {
        return res.data;
    }

    return undefined;
};

export const Cause = {
    from,
    ...select,
};
