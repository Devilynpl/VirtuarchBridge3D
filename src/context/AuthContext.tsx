'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
interface User {
    id: string;
    username: string;
    email: string;
    peer_id: string;
    public_key?: string; // Libsodium public key
    is_active: boolean;
    tier: string;
    channel?: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    keyPair: { publicKey: string; privateKey: string } | null;
    login: (token: string, user: User) => void;
    logout: () => void;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [keyPair, setKeyPair] = useState<{ publicKey: string; privateKey: string } | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const savedToken = localStorage.getItem('auth_token');
        const savedKeys = localStorage.getItem('chat_keys');
        if (savedKeys) {
            setKeyPair(JSON.parse(savedKeys));
        }
        if (savedToken) {
            fetchUser(savedToken);
        } else {
            autoAuth();
        }
    }, []);

    const autoAuth = async () => {
        setIsLoading(true);
        const storedNick = localStorage.getItem('beta_nick') || `user${Math.floor(10000 + Math.random() * 90000)}`;
        if (!localStorage.getItem('beta_nick')) {
            localStorage.setItem('beta_nick', storedNick);
        }
        const email = `${storedNick}@beta.local`;

        try {
            let res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password: 'beta' })
            });

            if (!res.ok) {
                res = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: storedNick, email, password: 'beta' }),
                });
            }

            if (res.ok) {
                const data = await res.json();
                if (data.token) {
                    login(data.token, data.user);
                }
            }
        } catch (e) {
            console.error('Auto auth failed', e);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchUser = async (authToken: string) => {
        try {
            const res = await fetch('/api/auth/me', {
                headers: { Authorization: `Bearer ${authToken}` },
            });
            if (res.ok) {
                const data = await res.json();
                setUser(data.user);
                setToken(authToken);
                setIsLoading(false);
            } else {
                localStorage.removeItem('auth_token');
                autoAuth();
            }
        } catch (err) {
            console.error('Auth check failed:', err);
            setIsLoading(false);
        }
    };

    const login = (authToken: string, userData: User) => {
        localStorage.setItem('auth_token', authToken);
        setToken(authToken);
        setUser(userData);

        // Ensure keys exist
        if (!localStorage.getItem('chat_keys')) {
            import('@/lib/crypto').then(async ({ generateKeyPair }) => {
                const keys = await generateKeyPair();
                localStorage.setItem('chat_keys', JSON.stringify(keys));
                setKeyPair(keys);

                // Proactively update user's public key in the backend (optional but recommended)
                fetch('/api/auth/update-keys', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({ public_key: keys.publicKey })
                });
            });
        }
    };

    const logout = () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('chat_keys');
        setToken(null);
        setUser(null);
        setKeyPair(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, keyPair, login, logout, isLoading }}>
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
