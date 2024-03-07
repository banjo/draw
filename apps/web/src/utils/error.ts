import { TRPCClientError } from "@trpc/client";
import toast from "react-hot-toast";

export const toastError = (error: unknown) => {
    if (error instanceof TRPCClientError) {
        toast.error(error.message);
    } else if (error instanceof Error) {
        toast.error(error.message);
    } else if (typeof error === "string") {
        toast.error(error);
    } else {
        toast.error("Something went wrong. Please try again.");
    }
};
