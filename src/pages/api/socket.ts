import { Server as SocketIOServer } from 'socket.io';
import { NextApiRequest } from 'next';
import { NextApiResponseServerIO } from '@/types/socket';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

const PUBLIC_CONV_ID = '00000000-0000-0000-0000-000000000001';

// Important: Next.js dev server reloads this file, we must persist the IO instance
// across hot reloads to avoid multiple servers.
const ioHandler = (req: NextApiRequest, res: NextApiResponseServerIO) => {
    if (!res.socket.server.io) {
        console.log('Initializing Socket.io server (Pages Router)...');

        const io = new SocketIOServer(res.socket.server as any, {
            path: '/api/socket',
            addTrailingSlash: false,
            cors: {
                origin: '*',
                methods: ['GET', 'POST'],
            },
        });

        // @ts-ignore
        global.io = io; // Persist globally as well for use in App Router API routes
        // @ts-ignore
        global.roomUsers = global.roomUsers || {};

        // Authentication Middleware
        io.use(async (socket, next) => {
            const token = socket.handshake.auth.token;
            if (token) {
                const user = await verifyToken(token);
                if (user) {
                    socket.data.user = user;
                    return next();
                }
            }
            next(new Error('Authentication error'));
        });

        io.on('connection', (socket) => {
            console.log('New WebSocket connection:', socket.id, socket.data.user?.username);

            socket.on('join_conversation', async ({ conversation_id }: { conversation_id: string }) => {
                const user = socket.data.user;
                if (!user) return;

                // Validate membership
                if (conversation_id !== PUBLIC_CONV_ID) {
                    const member = await prisma.conversationMember.findUnique({
                        where: {
                            conversation_id_user_id: {
                                conversation_id: conversation_id,
                                user_id: user.userId
                            }
                        }
                    });
                    if (!member) {
                        console.warn(`User ${user.username} tried to join forbidden room: conv_${conversation_id}`);
                        socket.emit('error', { message: 'Forbidden' });
                        return;
                    }
                }

                socket.join(`conv_${conversation_id}`);

                // Track user in room
                // @ts-ignore
                if (!global.roomUsers[`conv_${conversation_id}`]) {
                    // @ts-ignore
                    global.roomUsers[`conv_${conversation_id}`] = [];
                }

                // @ts-ignore
                const existing = global.roomUsers[`conv_${conversation_id}`].find(u => u.id === user.userId);
                if (!existing) {
                    // @ts-ignore
                    global.roomUsers[`conv_${conversation_id}`].push({
                        id: user.userId,
                        username: user.username,
                        peer_id: user.peer_id,
                        socketId: socket.id
                    });
                }

                console.log(`User ${user.username} joined room conv_${conversation_id}`);

                // Broadcast updated user list
                io.to(`conv_${conversation_id}`).emit('room_users', {
                    conversation_id,
                    // @ts-ignore
                    users: global.roomUsers[`conv_${conversation_id}`]
                });
            });

            socket.on('leave_conversation', ({ conversation_id }: { conversation_id: string }) => {
                socket.leave(`conv_${conversation_id}`);

                // Remove user from room tracking
                // @ts-ignore
                if (global.roomUsers[`conv_${conversation_id}`]) {
                    // @ts-ignore
                    global.roomUsers[`conv_${conversation_id}`] = global.roomUsers[`conv_${conversation_id}`].filter(u => u.socketId !== socket.id);

                    // Broadcast updated list
                    io.to(`conv_${conversation_id}`).emit('room_users', {
                        conversation_id,
                        // @ts-ignore
                        users: global.roomUsers[`conv_${conversation_id}`]
                    });
                }
            });

            socket.on('typing', ({ conversation_id, is_typing }: { conversation_id: string; is_typing: boolean }) => {
                socket.to(`conv_${conversation_id}`).emit('typing_status', {
                    user_id: socket.id,
                    conversation_id,
                    is_typing
                });
            });

            socket.on('disconnect', () => {
                console.log('WebSocket disconnected:', socket.id);

                // Clean up user from all rooms
                // @ts-ignore
                Object.keys(global.roomUsers).forEach(room => {
                    // @ts-ignore
                    const wasInRoom = global.roomUsers[room].some(u => u.socketId === socket.id);
                    if (wasInRoom) {
                        // @ts-ignore
                        global.roomUsers[room] = global.roomUsers[room].filter(u => u.socketId !== socket.id);
                        io.to(room).emit('room_users', {
                            conversation_id: room.replace('conv_', ''),
                            // @ts-ignore
                            users: global.roomUsers[room]
                        });
                    }
                });
            });
        });

        res.socket.server.io = io;
    }

    res.end();
};

export const config = {
    api: {
        bodyParser: false,
    },
};

export default ioHandler;
