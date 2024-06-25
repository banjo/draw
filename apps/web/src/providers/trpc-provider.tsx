import { trpc } from "@/lib/trpc";
import { authService } from "@/services/auth-service";
import { getHttpUrl, getWsUrl } from "@/utils/runtime";
import { TokenUtil } from "@/utils/token";
import { toMilliseconds } from "@banjoanton/utils";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createWSClient, httpBatchLink, splitLink, TRPCClientError, wsLink } from "@trpc/client";
import { Cause } from "common";
import { FC, PropsWithChildren, useState } from "react";
import { tokenRefreshLink } from "trpc-token-refresh-link";
import superjson from "superjson";

const createTrpcClient = ({ httpUrl, wsUrl }: { httpUrl: string; wsUrl: string }) =>
    trpc.createClient({
        links: [
            splitLink({
                condition: op => op.type === "subscription" || op.path.includes("collaboration"), // TODO: put this logic in common as it is used on server
                false: httpBatchLink({
                    url: `${httpUrl}/trpc`,
                    fetch(url, options) {
                        return fetch(url, {
                            ...options,
                            credentials: "include",
                        });
                    },
                    transformer: superjson,
                }),
                true: wsLink({
                    transformer: superjson,
                    client: createWSClient({
                        url: wsUrl,
                    }),
                }),
            }),
        ],
    });

export const TrpcProvider: FC<PropsWithChildren> = ({ children }) => {
    const [queryClient] = useState(() => new QueryClient());
    const [trpcClient] = useState(() =>
        createTrpcClient({ httpUrl: getHttpUrl(), wsUrl: getWsUrl() })
    );

    return (
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </trpc.Provider>
    );
};
