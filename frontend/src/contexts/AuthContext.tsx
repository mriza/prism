import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';
import { log } from '../utils/log';

interface User {
    userId: string;
    username: string;
    role: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string) => void;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [token, setToken] = useState<string | null>(localStorage.getItem('prism_token'));
    const [user, setUser] = useState<User | null>(null);

    const login = (newToken: string) => {
        localStorage.setItem('prism_token', newToken);
        setToken(newToken);
    };

    const logout = useCallback(() => {
        localStorage.removeItem('prism_token');
        setToken(null);
        setUser(null);
    }, []);

    useEffect(() => {
        if (token) {
            try {
                const decoded = jwtDecode<User>(token);
                // Check expiration
                const exp = (decoded as any).exp;
                if (exp && Date.now() >= exp * 1000) {
                    logout();
                } else {
                    setUser(decoded);
                }
            } catch (err) {
                log.error('Invalid token', err);
                logout();
            }
        } else {
            setUser(null);
        }
    }, [token, logout]);

    return (
        <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
