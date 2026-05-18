'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Asset } from '@/lib/assets';
import toast from 'react-hot-toast';

interface TransferContextType {
    cart: Asset[];
    addToCart: (asset: Asset) => void;
    removeFromCart: (id: string) => void;
    clearCart: () => void;
    checkout: (targetUserId: string) => Promise<void>;
    zipCount: number;
    refreshZipCount: () => Promise<void>;
    clearZips: () => Promise<void>;
    isProcessing: boolean;
}

const TransferContext = createContext<TransferContextType | undefined>(undefined);

export function TransferProvider({ children }: { children: React.ReactNode }) {
    const [cart, setCart] = useState<Asset[]>([]);
    const [zipCount, setZipCount] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);

    const refreshZipCount = useCallback(async () => {
        try {
            const res = await fetch('/api/transfer/status');
            if (res.ok) {
                const data = await res.json();
                setZipCount(data.count);
            }
        } catch (e) { }
    }, []);

    useEffect(() => {
        refreshZipCount();
        const interval = setInterval(refreshZipCount, 30000);
        return () => clearInterval(interval);
    }, [refreshZipCount]);

    const addToCart = (asset: Asset) => {
        setCart(prev => {
            if (prev.find(a => a.id === asset.id)) return prev;
            toast.success(`${asset.name} added to cart`);
            return [...prev, asset];
        });
    };

    const removeFromCart = (id: string) => {
        setCart(prev => prev.filter(a => a.id !== id));
    };

    const clearCart = () => setCart([]);

    const clearZips = async () => {
        try {
            const res = await fetch('/api/transfer/status', { method: 'DELETE' });
            if (res.ok) {
                setZipCount(0);
                toast.success('Transfer cleanup complete');
            }
        } catch (e) {
            toast.error('Cleanup failed');
        }
    };

    const checkout = async (userId: string) => {
        if (cart.length === 0) return;
        setIsProcessing(true);

        // We trigger a custom event that ChatPanel will listen to
        // This allows ChatPanel (which holds PeerJS connection) to handle the P2P part
        window.dispatchEvent(new CustomEvent('TRANSFER_CHECKOUT', {
            detail: {
                userId: userId,
                assetIds: cart.map(a => a.id)
            }
        }));

        toast.loading('Requesting transfer...', { id: 'checkout' });
    };

    // Listen for completed transfers from ChatPanel
    useEffect(() => {
        const handleSuccess = (e: Event) => {
            const { detail } = e as CustomEvent;
            toast.success(`Transfer complete: ${detail.count} files added`, { id: 'checkout' });
            clearCart();
        };

        const handleFail = (e: Event) => {
            const { detail } = e as CustomEvent;
            toast.error(`Transfer failed: ${detail.error}`, { id: 'checkout' });
            setIsProcessing(false);
        };

        window.addEventListener('TRANSFER_COMPLETE', handleSuccess);
        window.addEventListener('TRANSFER_ERROR', handleFail);
        return () => {
            window.removeEventListener('TRANSFER_COMPLETE', handleSuccess);
            window.removeEventListener('TRANSFER_ERROR', handleFail);
        };
    }, []);

    return (
        <TransferContext.Provider value={{
            cart, addToCart, removeFromCart, clearCart, checkout,
            zipCount, refreshZipCount, clearZips, isProcessing
        }}>
            {children}
        </TransferContext.Provider>
    );
}

export function useTransfer() {
    const context = useContext(TransferContext);
    if (!context) throw new Error('useTransfer must be used within TransferProvider');
    return context;
}
