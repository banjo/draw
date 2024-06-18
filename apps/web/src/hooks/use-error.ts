import { useAuth } from "@/contexts/auth-context";
import { firebaseService } from "@/services/firebase-service";
import { toastError } from "@/utils/error";
import { Maybe, attempt, defaults } from "@banjoanton/utils";
import { TRPCClientError } from "@trpc/client";
import { Cause } from "common";
import { toast as internalToast } from "react-hot-toast";

type HandleErrorOptionProps = {
    toast?: boolean;
    errorMessage?: string;
};

const DEFAULT_OPTIONS = {
    toast: false,
};

const causeLog: Record<Cause, Maybe<string>> = {
    EXPIRED_TOKEN: undefined,
    NOT_OWNER: "You are not the owner of this drawing",
    DRAWING_NOT_FOUND: "Drawing not found",
};

export const useError = () => {
    const handleError = async (error: unknown, opts?: HandleErrorOptionProps) => {
        const { toast, errorMessage } = defaults(opts, DEFAULT_OPTIONS);

        if (error instanceof TRPCClientError) {
            const cause = Cause.fromClientError(error);
            if (cause === Cause.EXPIRED_TOKEN) {
                await firebaseService.refreshToken();
            }

            const message = attempt(() => causeLog[cause as Cause]);
            if (message && toast) {
                internalToast.error(message);
                return;
            }

            if (errorMessage && toast) {
                internalToast.error(errorMessage);
                return;
            }

            if (toast) {
                toastError(error.message);
            }
            return;
        }

        if (errorMessage && toast) {
            internalToast.error(errorMessage);
        }

        if (toast) {
            if (error instanceof Error) {
                internalToast.error(error.message);
            } else if (typeof error === "string") {
                internalToast.error(error);
            } else {
                internalToast.error("An error occurred");
            }
        }
    };

    return {
        handleError,
    };
};
