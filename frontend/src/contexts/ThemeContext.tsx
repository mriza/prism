import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'corporate' | 'business';

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>(() => {
        const saved = localStorage.getItem('prism_theme') as Theme;
        return saved || 'business'; // Default to business (dark)
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('prism_theme', theme);
    }, [theme]);

    const setTheme = (newTheme: Theme) => setThemeState(newTheme);
    
    const toggleTheme = () => {
        setThemeState(prev => prev === 'corporate' ? 'business' : 'corporate');
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
