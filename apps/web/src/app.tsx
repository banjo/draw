import { Root } from "@/routes/root";
import { useGlobalLoadingStore } from "@/stores/use-global-loading-store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FC } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Toaster } from "react-hot-toast";
import { ErrorPage, GlobalLoading } from "ui";
import "./index.css";

const queryClient = new QueryClient();

export const App: FC = () => {
    const isLoading = useGlobalLoadingStore(state => state.isLoading);
    const loadingText = useGlobalLoadingStore(state => state.loadingText);

    return (
        <ErrorBoundary fallback={<ErrorPage />}>
            {/* <AuthProvider> */}
            <QueryClientProvider client={queryClient}>
                <Toaster />
                <GlobalLoading isLoading={isLoading} text={loadingText} />
                <Root />
            </QueryClientProvider>
            {/* </AuthProvider> */}
        </ErrorBoundary>
    );
};
