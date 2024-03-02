import { useAuth } from "@/contexts/auth-context";
import { trpc } from "@/lib/trpc";
import { getApiUrl } from "@/utils/runtime";
import { Maybe } from "@banjoanton/utils";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TRPCClientError, createWSClient, httpBatchLink, splitLink, wsLink } from "@trpc/client";
import { FC, PropsWithChildren, useState } from "react";
import superjson from "superjson";
import { Cause } from "utils";

const wsClient = createWSClient({
    url: `ws://localhost:3004`, // TODO: get from env
});

const createTrpcClient = (backendUrl: string, token: Maybe<string>) => {
    return trpc.createClient({
        links: [
            splitLink({
                condition: op => op.type === "subscription",
                false: httpBatchLink({
                    url: `${backendUrl}/trpc`,
                    fetch(url, options) {
                        return fetch(url, {
                            ...options,
                            credentials: "include",
                        });
                    },
                    headers: async () => {
                        if (token) {
                            return {
                                authorization: `Bearer ${token}`,
                            };
                        }

                        return {};
                    },
                }),
                true: wsLink({
                    client: wsClient,
                }),
            }),
        ],
        transformer: superjson,
    });
};

export const TrpcProvider: FC<PropsWithChildren> = ({ children }) => {
    const { token, refreshToken } = useAuth();
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        retry(failureCount, error) {
                            if (error instanceof TRPCClientError) {
                                if (
                                    error.data.code === "UNAUTHORIZED" &&
                                    error.shape?.cause === Cause.EXPIRED_TOKEN
                                ) {
                                    refreshToken(); // not best solution, but it works
                                }
                            }

                            return failureCount < 3;
                        },
                    },
                    mutations: {
                        retry(failureCount, error) {
                            if (error instanceof TRPCClientError) {
                                if (
                                    error.data.code === "UNAUTHORIZED" &&
                                    error.shape?.cause === Cause.EXPIRED_TOKEN
                                ) {
                                    refreshToken(); // not best solution, but it works
                                }
                            }

                            return failureCount < 3;
                        },
                    },
                },
            })
    );
    const [trpcClient] = useState(() => createTrpcClient(getApiUrl(), token));

    return (
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </trpc.Provider>
    );
};
