import { Maybe } from "@banjoanton/utils";
import { PropsWithChildren } from "react";

type Props = {
    isLoading: boolean;
    text: Maybe<string>;
};

export const Loader = ({ children }: PropsWithChildren) => (
    <div className="fixed top-0 left-0 w-full h-full z-50 flex flex-col gap-4 justify-center items-center backdrop-blur-sm bg-white dark:bg-gray-900">
        <div
            className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite] dark:border-gray-300 dark:border-r-transparent"
            role="status"
        />
        <span className="text-black dark:text-white">{children}</span>
    </div>
);

export const GlobalLoading = ({ isLoading, text }: Props) => {
    if (!isLoading) {
        return null;
    }

    return <Loader>{text}</Loader>;
};
