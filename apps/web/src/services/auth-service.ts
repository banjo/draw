import { attemptAsync } from "@banjoanton/utils";
import { AuthInfo, CoreResponse, Env } from "common";
import toast from "react-hot-toast";

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
    }

    public async checkIfUserIsAuthenticated() {
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

    /** Only works when the API runs with `LOCAL_DEVELOPMENT=true` */
    public signInLocally() {
        window.location.href = `${env.VITE_API_URL}/login/local`;
    }

    public async signOut() {
        const signOutUrl = `${env.VITE_API_URL}/logout`;
        const response = await attemptAsync(
            async () => await fetch(signOutUrl, { method: "POST", credentials: "include" })
        );

        if (!response?.ok) {
            toast.error("Could not sign out");
            return;
        }

        // Reload, so the WebSocket connects again without the session
        window.location.reload();
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
