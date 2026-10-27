import { createContext, ReactNode, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
    children: ReactNode;
    defaultTheme?: Theme;
    storageKey?: string;
};

type ThemeProviderState = {
    theme: Theme;
    /** The theme in use: "system" resolved to the OS theme */
    resolvedTheme: "dark" | "light";
    setTheme: (theme: Theme) => void;
};

const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");
const getSystemTheme = (): "dark" | "light" => (darkQuery().matches ? "dark" : "light");

const initialState: ThemeProviderState = {
    theme: "system",
    resolvedTheme: "light",
    setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
    children,
    defaultTheme = "system",
    storageKey = "banjo-theme",
    ...props
}: ThemeProviderProps) {
    const [theme, setTheme] = useState<Theme>(
        () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
    );

    const [systemTheme, setSystemTheme] = useState(getSystemTheme);
    const resolvedTheme = theme === "system" ? systemTheme : theme;

    // Follow the OS when it switches between light and dark
    useEffect(() => {
        const query = darkQuery();
        const onChange = () => setSystemTheme(getSystemTheme());
        query.addEventListener("change", onChange);
        return () => query.removeEventListener("change", onChange);
    }, []);

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove("light", "dark");
        root.classList.add(resolvedTheme);
    }, [resolvedTheme]);

    const value = {
        theme,
        resolvedTheme,
        setTheme: (theme: Theme) => {
            localStorage.setItem(storageKey, theme);
            setTheme(theme);
        },
    };

    return (
        <ThemeProviderContext.Provider {...props} value={value}>
            {children}
        </ThemeProviderContext.Provider>
    );
}

export const useTheme = () => {
    const context = useContext(ThemeProviderContext);

    if (context === undefined) throw new Error("useTheme must be used within a ThemeProvider");

    return context;
};
