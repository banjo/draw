import { createContext, useContext, useEffect, useState } from "react";
import { Loader } from "ui";
import { authService, AuthState, emtpyAuthState } from "@/services/auth-service";

export type AuthContextType = {
    isLoading: boolean;
    authState: AuthState;
};

const emptyContext: AuthContextType = {
    isLoading: false,
    authState: emtpyAuthState,
};

const AuthContext = createContext<AuthContextType>(emptyContext);

export const useAuth = () => useContext(AuthContext);

type AuthProviderProps = {
    children: React.ReactNode;
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
    const [authState, setAuthState] = useState<AuthState>(authService.getAuthState());
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const handleAuthStateChange = (state: AuthState) => {
            const clone = structuredClone(state);
            setAuthState(clone); // deep clone to avoid reference issues
            setIsLoading(false);
        };

        authService.addAuthStateListener(handleAuthStateChange);
        authService.checkIfUserIsAuthenticated();
        return () => {
            authService.removeAuthStateListener(handleAuthStateChange);
        };
    }, []);

    const contextValue: AuthContextType = {
        authState,
        isLoading,
    };

    return (
        <AuthContext.Provider value={contextValue}>
            {isLoading ? <Loader>Loading...</Loader> : children}
        </AuthContext.Provider>
    );
};
