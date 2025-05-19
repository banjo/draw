import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { authService, AuthState, emptyAuthState } from "@/services/auth-service";
import { Loader } from "@/components/global-loading";

export type AuthContextType = AuthState & {
    isLoading: boolean;
};

const emptyContext: AuthContextType = {
    isLoading: false,
    ...emptyAuthState,
};

const AuthContext = createContext<AuthContextType>(emptyContext);

export const useAuth = () => useContext(AuthContext);

type AuthProviderProps = {
    children: ReactNode;
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
    const [authState, setAuthState] = useState<AuthState>(() => authService.getAuthState());
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
        isLoading,
        ...authState,
    };

    return (
        <AuthContext.Provider value={contextValue}>
            {isLoading ? <Loader>Loading...</Loader> : children}
        </AuthContext.Provider>
    );
};
