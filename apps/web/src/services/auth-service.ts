import { auth } from "@/lib/firebase";
import { logger } from "@/utils/logger";
import { isLocalDevelopment } from "@/utils/runtime";
import { Maybe, raise } from "@banjoanton/utils";
import { Env } from "common";
import {
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithPopup,
    signOut,
    User,
} from "firebase/auth";

export type AuthState = {
    user: User | null;
    token: string | undefined;
};

class AuthService {
    private user: User | null = null;
    private token: Maybe<string> = undefined;
    private listeners: Array<(state: AuthState) => void> = [];

    constructor() {
        this.user = null;
        this.token = undefined;
        this.initAuthStateListener();
        this.setupDevelopment();
    }

    private setupDevelopment() {
        if (isLocalDevelopment()) {
            const uid =
                Env.client().VITE_DEVELOPMENT_UID ?? raise("VITE_DEVELOPMENT_UID not specified");

            this.user = { uid } as User;
            this.token = "development";
            this.notifyListeners();
        }
    }

    private async initAuthStateListener() {
        if (isLocalDevelopment()) return;

        onAuthStateChanged(auth, async currentUser => {
            this.user = currentUser;
            if (currentUser) {
                await this.refreshToken();
            } else {
                this.token = undefined;
            }
            this.notifyListeners();
        });
    }

    public async signInWithGoogle() {
        const provider = new GoogleAuthProvider();
        try {
            const result = await signInWithPopup(auth, provider);
            this.user = result.user;
            await this.refreshToken();
            this.notifyListeners();
        } catch (error) {
            logger.error({ error }, "Error signing in with Google");
        }
    }

    public async signOut() {
        try {
            await signOut(auth);
            this.user = null;
            this.token = undefined;
            this.notifyListeners();
        } catch (error) {
            logger.error({ error }, "Error signing out");
        }
    }

    public async refreshToken() {
        if (isLocalDevelopment() || !this.user) return;

        try {
            const newToken = await this.user.getIdToken(true);
            this.token = newToken;
            this.notifyListeners();
        } catch (error) {
            logger.error({ error }, "Error refreshing token");
        }
    }

    public getAuthState(): AuthState {
        return {
            user: this.user,
            token: this.token,
        };
    }

    public addAuthStateListener(listener: (state: AuthState) => void) {
        this.listeners.push(listener);
    }

    public removeAuthStateListener(listener: (state: AuthState) => void) {
        this.listeners = this.listeners.filter(l => l !== listener);
    }

    private notifyListeners() {
        const state = this.getAuthState();
        this.listeners.forEach(listener => listener(state));
    }
}

export const authService = new AuthService();
