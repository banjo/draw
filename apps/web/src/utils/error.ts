import { TRPCClientError } from "@trpc/client";
import toast from "react-hot-toast";

export const toastError = (error: unknown) => {
    const message = ["An error occurred: "];

    if (error instanceof TRPCClientError) {
        message.push(error.message);
    } else if (error instanceof Error) {
        message.push(error.message);
    } else if (typeof error === "string") {
        toast.error(error);
        message.push(error);
    } else {
        message.push("Please try again later.");
    }

    toast.error(message.join(""));
};
