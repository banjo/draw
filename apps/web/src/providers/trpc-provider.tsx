import { useAuth } from "@/contexts/auth-context";
import { trpc } from "@/lib/trpc";
import { firebaseService } from "@/services/firebase-service";
import { getHttpUrl, getWsUrl } from "@/utils/runtime";
import { TokenUtil } from "@/utils/token";
import { Maybe, toMilliseconds } from "@banjoanton/utils";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TRPCClientError, createWSClient, httpBatchLink, splitLink, wsLink } from "@trpc/client";
import { Cause } from "common";
import { FC, PropsWithChildren, useState } from "react";
import superjson from "superjson";
import { tokenRefreshLink } from "trpc-token-refresh-link";

const createTrpcClient = ({ httpUrl, wsUrl }: { httpUrl: string; wsUrl: string }) => {
    return trpc.createClient({
        links: [
            tokenRefreshLink({
                // access to the original tRPC query operation object
                // is accessible on both methods
                tokenRefreshNeeded: () => {
                    const token = firebaseService.getAuthState().token;
                    if (!token) return true;

                    const shouldRefresh = TokenUtil.needRefresh(
                        token,
                        toMilliseconds({ minutes: 1 })
                    );

                    if (shouldRefresh) {
                        return true;
                    }

                    return false;
                },
                fetchAccessToken: async () => {
                    await firebaseService.refreshToken();
                },
            }),
            splitLink({
                condition: op => op.type === "subscription" || op.path.includes("collaboration"),
                false: httpBatchLink({
                    url: `${httpUrl}/trpc`,
                    fetch(url, options) {
                        return fetch(url, {
                            ...options,
                            credentials: "include",
                        });
                    },
                    headers: async () => {
                        const token = firebaseService.getAuthState().token;
                        if (token) {
                            return {
                                authorization: `Bearer ${token}`,
                            };
                        }

                        return {};
                    },
                }),
                true: wsLink({
                    client: createWSClient({
                        url: wsUrl,
                    }),
                }),
            }),
        ],
        transformer: superjson,
    });
};

export const TrpcProvider: FC<PropsWithChildren> = ({ children }) => {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        retry(failureCount, error) {
                            if (error instanceof TRPCClientError) {
                                if (
                                    error.data?.code === "UNAUTHORIZED" &&
                                    error.shape?.cause === Cause.EXPIRED_TOKEN
                                ) {
                                    firebaseService.refreshToken(); // not best solution, but it works
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
                                    firebaseService.refreshToken(); // not best solution, but it works
                                }
                            }

                            return failureCount < 3;
                        },
                    },
                },
            })
    );
    const [trpcClient] = useState(() =>
        createTrpcClient({ httpUrl: getHttpUrl(), wsUrl: getWsUrl() })
    );

    return (
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </trpc.Provider>
    );
};
