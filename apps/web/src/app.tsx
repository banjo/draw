import { trpc } from "@/lib/trpc";
import { Root } from "@/routes/root";
import { useGlobalLoadingStore } from "@/stores/use-global-loading-store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { FC, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Toaster } from "react-hot-toast";
import superjson from "superjson";
import { ErrorPage, GlobalLoading } from "ui";
import "./index.css";

export const App: FC = () => {
    // TODO: move to a separete component
    const isLoading = useGlobalLoadingStore(state => state.isLoading);
    const loadingText = useGlobalLoadingStore(state => state.loadingText);

    const [queryClient] = useState(() => new QueryClient());
    const [trpcClient] = useState(() =>
        trpc.createClient({
            links: [
                httpBatchLink({
                    url: "http://localhost:3003/trpc",
                    fetch(url, options) {
                        return fetch(url, {
                            ...options,
                            credentials: "include",
                        });
                    },
                    async headers() {
                        return {
                            authorization: "Bearer 123",
                        };
                    },
                }),
            ],
            transformer: superjson,
        })
    );

    return (
        <ErrorBoundary fallback={<ErrorPage />}>
            <trpc.Provider client={trpcClient} queryClient={queryClient}>
                <QueryClientProvider client={queryClient}>
                    {/* <AuthProvider> */}
                    <Toaster />
                    <GlobalLoading isLoading={isLoading} text={loadingText} />
                    <Root />
                    {/* </AuthProvider> */}
                </QueryClientProvider>
            </trpc.Provider>
        </ErrorBoundary>
    );
};
