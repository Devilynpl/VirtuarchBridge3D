import prisma from '../../../../../lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth';

const PUBLIC_CONV_ID = '00000000-0000-0000-0000-000000000001';

async function checkMembership(userId: string, conversationId: string) {
    if (conversationId === PUBLIC_CONV_ID) return true;

    const member = await prisma.conversationMember.findUnique({
        where: {
            conversation_id_user_id: {
                conversation_id: conversationId,
                user_id: userId
            }
        }
    })
    return !!member
}

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const user = await verifyAuth(req);
    const userId = user?.userId as string | undefined;

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: conversationId } = await context.params

    const isMember = await checkMembership(userId, conversationId)
    if (!isMember) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const before = searchParams.get('before')

    try {
        const messages = await prisma.message.findMany({
            where: {
                conversation_id: conversationId,
                ...(before ? { created_at: { lt: new Date(before) } } : {})
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        username: true,
                        avatar_url: true
                    }
                },
                attachments: true
            },
            orderBy: { created_at: 'desc' },
            take: limit
        })

        return NextResponse.json({ messages: messages.reverse() })
    } catch (error) {
        console.error('Fetch messages error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const user = await verifyAuth(req);
    const userId = user?.userId as string | undefined;

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }



    const { id: conversationId } = await context.params

    const isMember = await checkMembership(userId, conversationId)
    if (!isMember) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
        const { content, type, metadata, reply_to } = await req.json()

        // Restrict allowed types to prevent spoofing system messages or requests
        const allowedTypes = ['text', 'image', 'file'];
        const msgType = allowedTypes.includes(type) ? type : 'text';

        if (!content && msgType !== 'file' && msgType !== 'image') {
            return NextResponse.json({ error: 'Content is required' }, { status: 400 })
        }

        const message = await prisma.message.create({
            data: {
                conversation_id: conversationId,
                sender_id: userId,
                content: content || '',
                type: msgType,
                metadata: metadata ? JSON.stringify(metadata) : null,
                reply_to
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        username: true,
                        avatar_url: true
                    }
                }
            }
        })

        // Update conversation's updated_at
        await prisma.conversation.update({
            where: { id: conversationId },
            data: { updated_at: new Date() }
        })

        // Emit via Socket.io if initialized
        // @ts-ignore
        if (global.io) {
            console.log(`Emitting new_message to room conv_${conversationId}`);
            // @ts-ignore
            global.io.to(`conv_${conversationId}`).emit('new_message', message);
        }

        return NextResponse.json({ message }, { status: 201 })
    } catch (error) {
        console.error('Send message error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
