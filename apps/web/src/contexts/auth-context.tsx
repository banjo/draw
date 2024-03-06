import { auth } from "@/lib/firebase";
import { isDev } from "@/utils/runtime";
import { Maybe, raise } from "@banjoanton/utils";
import { Env } from "common";
import {
    GoogleAuthProvider,
    User,
    onAuthStateChanged,
    signInWithPopup,
    signOut,
} from "firebase/auth";

import jwtDecode from "jwt-decode";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Loader } from "ui";

export type AuthContextType = {
    user: User | null;
    userId: string | undefined;
    isLoading: boolean;
    signOut: () => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    token: string | undefined;
    refreshToken: () => Promise<void>;
};

const emptyContext: AuthContextType = {
    userId: undefined,
    isLoading: false,
    signInWithGoogle: async () => {},
    signOut: async () => {},
    user: null,
    token: undefined,
    refreshToken: async () => {},
};

const AuthContext = createContext<AuthContextType>(emptyContext);

export const useAuth = () => {
    return useContext(AuthContext);
};

type AuthProviderProps = {
    children: React.ReactNode;
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<Maybe<string>>();
    const [isLoading, setIsLoading] = useState(true);

    const timeoutRef = useRef<NodeJS.Timeout>();
    const initialLoadCompletedRef = useRef(false);

    const signInWithGoogle = useCallback(async () => {
        const provider = new GoogleAuthProvider();
        try {
            const result = await signInWithPopup(auth, provider);
            setUser(result.user);
        } catch (error) {
            console.error(error);
        }
    }, []);

    const handleSignOut = useCallback(async () => {
        try {
            await signOut(auth);
            setUser(null);
            setToken(undefined);
        } catch (error) {
            console.error(error);
        }
    }, []);

    const refreshToken = useCallback(async () => {
        if (!user) return;

        if (!initialLoadCompletedRef.current) {
            setIsLoading(true);
        }

        try {
            const newToken = await user.getIdToken(true);
            setToken(newToken);
            const decodedToken: { exp: number } = jwtDecode(newToken);
            const expirationTime = decodedToken.exp * 1000 - 5 * 60 * 1000; // Safe margin 5 min
            const id = setTimeout(refreshToken, expirationTime - Date.now());
            timeoutRef.current = id;

            if (!initialLoadCompletedRef.current) {
                initialLoadCompletedRef.current = true;
            }

            setIsLoading(false);
        } catch (error) {
            console.error("Error refreshing token", error);
            setIsLoading(false);
        }
    }, [user]);

    // Development mode without authentication
    useEffect(() => {
        if (isDev()) {
            const uid =
                Env.client().VITE_DEVELOPMENT_UID ?? raise("VITE_DEVELOPMENT_UID not specified");

            setUser({
                uid,
            } as User);
            setToken("development");
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isDev()) return;

        const unsubscribe = onAuthStateChanged(auth, async currentUser => {
            setUser(currentUser);
            if (currentUser) {
                await refreshToken();
            } else {
                setIsLoading(false);
            }
        });

        return () => {
            unsubscribe();
            clearTimeout(timeoutRef.current);
        };
    }, [refreshToken]);

    useEffect(() => {
        if (isDev()) return;

        if (!user) {
            setToken(undefined);
            initialLoadCompletedRef.current = false;
            return;
        }

        refreshToken();
    }, [user, refreshToken]);

    const contextValue: AuthContextType = {
        user,
        userId: user?.uid,
        token,
        isLoading,
        signInWithGoogle,
        signOut: handleSignOut,
        refreshToken,
    };

    return (
        <AuthContext.Provider value={contextValue}>
            {isLoading ? <Loader>Loading...</Loader> : children}
        </AuthContext.Provider>
    );
};
