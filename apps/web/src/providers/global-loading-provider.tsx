import { useGlobalLoadingStore } from "@/stores/use-global-loading-store";
import { FC, PropsWithChildren } from "react";
import { GlobalLoading } from "ui";

export const GlobalLoadingProvider: FC<PropsWithChildren> = ({ children }) => {
    const isLoading = useGlobalLoadingStore(state => state.isLoading);
    const loadingText = useGlobalLoadingStore(state => state.loadingText);
    return (
        <>
            <GlobalLoading isLoading={isLoading} text={loadingText} />
            {children}
        </>
    );
};
