import { isLocalDevelopment } from "@/utils/runtime";
import { Env } from "common";

const env = Env.client();

export type AuthState = {
    isAuthenticated: boolean;
};

class AuthService {
    private isAuthenticated = false;
    private listeners: Array<(state: AuthState) => void> = [];

    constructor() {
        this.isAuthenticated = false;
        this.setupDevelopment();
    }

    private setupDevelopment() {
        if (isLocalDevelopment()) {
            this.isAuthenticated = true;
            this.notifyListeners();
        }
    }

    public async checkIfUserIsAuthenticated() {
        if (isLocalDevelopment()) {
            return;
        }

        const authUrl = `${env.VITE_API_URL}/auth`;

        const response = await fetch(authUrl, {
            credentials: "include", // Send cookies
        });

        if (response.ok) {
            this.isAuthenticated = true;
        } else {
            this.isAuthenticated = false;
        }

        this.notifyListeners();
    }

    public async signInWithGithub() {
        window.location.href = `${env.VITE_API_URL}/login/github`;
    }

    public async signOut() {
        const signOutUrl = `${env.VITE_API_URL}/logout`;
        fetch(signOutUrl, {
            credentials: "include",
        });
        this.isAuthenticated = false;
        this.notifyListeners();
    }

    public getAuthState(): AuthState {
        return {
            isAuthenticated: this.isAuthenticated,
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
