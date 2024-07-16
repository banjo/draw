import { isLocalDevelopment } from "@/utils/runtime";
import { attemptAsync } from "@banjoanton/utils";
import { AuthInfo, CoreResponse, Env } from "common";

const env = Env.client();

export type AuthState = AuthInfo & {
    isAuthenticated: boolean;
};

export const emptyAuthState: AuthState = {
    isAuthenticated: false,
    email: "",
};

class AuthService {
    private authState: AuthState;
    private listeners: Array<(state: AuthState) => void> = [];

    constructor() {
        this.authState = emptyAuthState;
        this.setupDevelopment();
    }

    private setupDevelopment() {
        if (isLocalDevelopment()) {
            this.authState = {
                isAuthenticated: true,
                email: "local@local.com",
            };
            this.notifyListeners();
        }
    }

    public async checkIfUserIsAuthenticated() {
        if (isLocalDevelopment()) {
            return;
        }

        const authUrl = `${env.VITE_API_URL}/auth`;

        const response = await attemptAsync<CoreResponse<AuthInfo>>(
            async () =>
                await fetch(authUrl, {
                    credentials: "include",
                }).then(res => res.json())
        );

        if (response?.success) {
            this.authState = {
                isAuthenticated: true,
                ...response.data,
            };
        } else {
            this.authState = emptyAuthState;
        }

        this.notifyListeners();
    }

    public signInWithGithub() {
        window.location.href = `${env.VITE_API_URL}/login/github`;
    }

    public signInWithGoogle() {
        window.location.href = `${env.VITE_API_URL}/login/google`;
    }

    public async signOut() {
        const signOutUrl = `${env.VITE_API_URL}/logout`;
        fetch(signOutUrl, {
            credentials: "include",
        });
        this.authState = emptyAuthState;
        this.notifyListeners();
    }

    public getAuthState(): AuthState {
        return this.authState;
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
