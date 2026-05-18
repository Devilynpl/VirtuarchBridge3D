import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { ServerToClientEvents, ClientToServerEvents } from '../types/socket';
import { useAuth } from '@/context/AuthContext';
import { useNetwork } from '@/context/NetworkContext';

export const useSocket = () => {
    const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const { token } = useAuth();
    const { isOnline } = useNetwork();

    useEffect(() => {
        if (!token) return;

        if (!isOnline) {
            setSocket(null);
            setIsConnected(false);
            return;
        }

        let isMounted = true;

        // We call the API to ensure the socket server is initialized
        fetch('/api/socket').finally(() => {
            if (!isMounted) return;

            const socketInstance: any = io(process.env.NEXT_PUBLIC_SITE_URL || '', {
                path: '/api/socket',
                addTrailingSlash: false,
                auth: {
                    token: token
                }
            });

            socketInstance.on('connect', () => {
                console.log('Socket.io connected');
                if (isMounted) setIsConnected(true);
            });

            socketInstance.on('disconnect', () => {
                console.log('Socket.io disconnected');
                if (isMounted) setIsConnected(false);
            });

            setSocket(socketInstance);
        });

        return () => {
            isMounted = false;
        };
    }, [token, isOnline]);

    // Cleanup effect
    useEffect(() => {
        return () => {
            if (socket) {
                socket.disconnect();
            }
        };
    }, [socket]);

    return { socket, isConnected };
};
