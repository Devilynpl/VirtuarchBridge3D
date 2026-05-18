import { Server as NetServer, Socket } from 'net';
import { NextApiResponse } from 'next';
import { Server as SocketIOServer } from 'socket.io';

export type NextApiResponseServerIO = NextApiResponse & {
    socket: Socket & {
        server: NetServer & {
            io: SocketIOServer;
        };
    };
};

export interface ServerToClientEvents {
    new_message: (payload: any) => void;
    asset_request_created: (payload: any) => void;
    asset_request_fulfilled: (payload: any) => void;
    user_status_changed: (payload: { user_id: string; status: string }) => void;
    typing_status: (payload: { user_id: string; conversation_id: string; is_typing: boolean }) => void;
    room_users: (payload: { conversation_id: string; users: any[] }) => void;
    message_updated: (payload: any) => void;
}

export interface ClientToServerEvents {
    join_conversation: (payload: { conversation_id: string; user?: { id: string; username: string } | null }) => void;
    leave_conversation: (payload: { conversation_id: string; user?: { id: string; username: string } | null }) => void;
    typing: (payload: { conversation_id: string; is_typing: boolean }) => void;
}
