import { useAuth } from "@/contexts/auth-context";
import { trpc } from "@/lib/trpc";
import { getApiUrl } from "@/utils/runtime";
import { Maybe } from "@banjoanton/utils";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { FC, PropsWithChildren, useState } from "react";
import superjson from "superjson";

const createTrpcClient = (backendUrl: string, token: Maybe<string>) => {
    return trpc.createClient({
        links: [
            httpBatchLink({
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
        ],
        transformer: superjson,
    });
};

export const TrpcProvider: FC<PropsWithChildren> = ({ children }) => {
    const { token } = useAuth();
    const [queryClient] = useState(() => new QueryClient());
    const [trpcClient] = useState(() => createTrpcClient(getApiUrl(), token));

    return (
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </trpc.Provider>
    );
};
