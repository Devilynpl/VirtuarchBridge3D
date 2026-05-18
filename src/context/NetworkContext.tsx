'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import toast from 'react-hot-toast';

interface NetworkContextType {
    isOnline: boolean;
    toggleOfflineMode: () => void;
    isOfflineMode: boolean; // Explicit 'offline mode' enabled by user
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: ReactNode }) {
    // isOfflineMode is the USER PREFERENCE (switch)
    const [isOfflineMode, setIsOfflineMode] = useState(false);
    // isOnline is the ACTUAL effective state (browser online + user preference)
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        // Initialize from local storage if available
        const savedMode = localStorage.getItem('offlineMode');
        if (savedMode) {
            setIsOfflineMode(savedMode === 'true');
        }
    }, []);

    useEffect(() => {
        const handleOnline = () => {
            if (!isOfflineMode) setIsOnline(true);
        };
        const handleOffline = () => {
            setIsOnline(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Initial check
        setIsOnline(navigator.onLine && !isOfflineMode);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [isOfflineMode]);

    const toggleOfflineMode = () => {
        const newMode = !isOfflineMode;
        setIsOfflineMode(newMode);
        localStorage.setItem('offlineMode', String(newMode));

        if (newMode) {
            setIsOnline(false);
            toast('Offline Mode Enabled', { icon: '📴' });
        } else {
            setIsOnline(navigator.onLine);
            if (navigator.onLine) toast('Online Mode Enabled', { icon: '🌐' });
            else toast.error('Browser is still offline');
        }
    };

    return (
        <NetworkContext.Provider value={{ isOnline, toggleOfflineMode, isOfflineMode }}>
            {children}
        </NetworkContext.Provider>
    );
}

export const useNetwork = () => {
    const context = useContext(NetworkContext);
    if (!context) {
        throw new Error('useNetwork must be used within a NetworkProvider');
    }
    return context;
};
