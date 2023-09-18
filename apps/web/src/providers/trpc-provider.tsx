import { trpc } from "@/lib/trpc";
import { getUrl } from "@/utils/runtime";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { FC, PropsWithChildren, useState } from "react";
import superjson from "superjson";

export const TrpcProvider: FC<PropsWithChildren> = ({ children }) => {
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
                    async headers() {
                        return {
                            authorization: "Bearer 123",
                        };
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
