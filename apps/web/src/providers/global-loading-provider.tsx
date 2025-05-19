import { GlobalLoading } from "@/components/global-loading";
import { useGlobalLoadingStore } from "@/stores/use-global-loading-store";
import { FC, PropsWithChildren } from "react";

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
