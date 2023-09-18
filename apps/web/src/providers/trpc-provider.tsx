import { useAuth } from "@/contexts/auth-context";
import { trpc } from "@/lib/trpc";
import { getUrl } from "@/utils/runtime";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { FC, PropsWithChildren, useState } from "react";
import superjson from "superjson";

export const TrpcProvider: FC<PropsWithChildren> = ({ children }) => {
    const { token } = useAuth();
    const [queryClient] = useState(() => new QueryClient());
    const [trpcClient] = useState(() => {
        const url = getUrl();

        return trpc.createClient({
            links: [
                httpBatchLink({
                    url: `${url}/trpc`,
                    fetch(url, options) {
                        return fetch(url, {
                            ...options,
                            credentials: "include",
                        });
                    },
                    headers: async () => {
                        if (token && token.length > 0) {
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
    });
    return (
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </trpc.Provider>
    );
};
