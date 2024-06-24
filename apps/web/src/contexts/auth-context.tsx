import { createContext, useContext, useEffect, useState } from "react";
import { Loader } from "ui";
import { User } from "firebase/auth";
import { authService, AuthState } from "@/services/auth-service";

export type AuthContextType = {
    isLoading: boolean;
    isAuthenticated: boolean;
};

const emptyContext: AuthContextType = {
    isLoading: false,
    isAuthenticated: false,
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
            setAuthState(state);
            setIsLoading(false);
        };

        authService.addAuthStateListener(handleAuthStateChange);
        authService.checkIfUserIsAuthenticated();
        return () => {
            authService.removeAuthStateListener(handleAuthStateChange);
        };
    }, []);

    const contextValue: AuthContextType = {
        isAuthenticated: authState.isAuthenticated,
        isLoading,
    };

    return (
        <AuthContext.Provider value={contextValue}>
            {isLoading ? <Loader>Loading...</Loader> : children}
        </AuthContext.Provider>
    );
};
