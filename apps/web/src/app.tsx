import { AuthProvider } from "@/contexts/auth-context";
import { GlobalContextProvider } from "@/contexts/global-context";
import { GlobalLoadingProvider } from "@/providers/global-loading-provider";
import { TrpcProvider } from "@/providers/trpc-provider";
import { Root } from "@/routes/root";
import { FC } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Toaster } from "react-hot-toast";
import { ErrorPage } from "ui";
import "./index.css";
import { ThemeProvider } from "@/providers/theme-provider";

export const App: FC = () => (
    <ErrorBoundary fallback={<ErrorPage />}>
        <AuthProvider>
            <TrpcProvider>
                <ThemeProvider>
                    <GlobalLoadingProvider>
                        <GlobalContextProvider>
                            <Toaster />
                            <Root />
                        </GlobalContextProvider>
                    </GlobalLoadingProvider>
                </ThemeProvider>
            </TrpcProvider>
        </AuthProvider>
    </ErrorBoundary>
);
