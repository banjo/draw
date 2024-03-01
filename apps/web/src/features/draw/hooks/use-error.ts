import { useAuth } from "@/contexts/auth-context";
import { toastError } from "@/utils/error";
import { defaults } from "@banjoanton/utils";
import { TRPCClientError } from "@trpc/client";
import { toast as internalToast } from "react-hot-toast";
import { Cause } from "utils";

type HandleErrorOptionProps = {
    toast?: boolean;
    errorMessage?: string;
};

const DEFAULT_OPTIONS = {
    toast: false,
};

export const useError = () => {
    const { refreshToken } = useAuth();

    const handleError = async (error: unknown, opts?: HandleErrorOptionProps) => {
        const { toast, errorMessage } = defaults(opts, DEFAULT_OPTIONS);

        if (error instanceof TRPCClientError) {
            if (error.shape?.cause === Cause.EXPIRED_TOKEN) {
                await refreshToken();
            }
        }

        if (errorMessage && toast) {
            internalToast.error(errorMessage);
        } else if (toast) {
            toastError(error);
        }
    };

    return {
        handleError,
    };
};
