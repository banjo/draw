import { trpc } from "@/lib/trpc";
import { authService } from "@/services/auth-service";
import { getHttpUrl, getWsUrl } from "@/utils/runtime";
import { TokenUtil } from "@/utils/token";
import { toMilliseconds } from "@banjoanton/utils";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createWSClient, httpBatchLink, splitLink, TRPCClientError, wsLink } from "@trpc/client";
import { Cause } from "common";
import { FC, PropsWithChildren, useState } from "react";
import superjson from "superjson";
import { tokenRefreshLink } from "trpc-token-refresh-link";

const createTrpcClient = ({ httpUrl, wsUrl }: { httpUrl: string; wsUrl: string }) =>
    trpc.createClient({
        links: [
            tokenRefreshLink({
                // access to the original tRPC query operation object
                // is accessible on both methods
                tokenRefreshNeeded: () => {
                    const token = authService.getAuthState().token;
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
                    await authService.refreshToken();
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
                        const token = authService.getAuthState().token;
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

export const TrpcProvider: FC<PropsWithChildren> = ({ children }) => {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        retry(failureCount, error) {
                            if (
                                error instanceof TRPCClientError &&
                                error.data?.code === "UNAUTHORIZED" &&
                                error.shape?.cause === Cause.EXPIRED_TOKEN
                            ) {
                                authService.refreshToken(); // not best solution, but it works
                            }

                            return failureCount < 3;
                        },
                    },
                    mutations: {
                        retry(failureCount, error) {
                            if (
                                error instanceof TRPCClientError &&
                                error.data.code === "UNAUTHORIZED" &&
                                error.shape?.cause === Cause.EXPIRED_TOKEN
                            ) {
                                authService.refreshToken(); // not best solution, but it works
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
