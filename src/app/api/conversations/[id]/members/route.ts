import prisma from '../../../../../lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '@/lib/auth';

async function getAuthUser(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null
    }

    const token = authHeader.split(' ')[1]
    try {
        const decoded: any = jwt.verify(token, JWT_SECRET)
        return decoded.userId
    } catch (error) {
        return null
    }
}

// POST: Add a member to a conversation (invite)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const userId = await getAuthUser(req)
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: conversationId } = await params
    const { user_id: targetUserId } = await req.json()

    if (!targetUserId) {
        return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
    }

    try {
        // Check if requester is the owner
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { members: true }
        })

        if (!conversation) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
        }

        const isOwner = conversation.created_by === userId
        if (!isOwner) {
            return NextResponse.json({ error: 'Only the channel owner can invite members' }, { status: 403 })
        }

        // Add member
        const member = await prisma.conversationMember.create({
            data: {
                conversation_id: conversationId,
                user_id: targetUserId,
                role: 'member'
            }
        })

        return NextResponse.json({ member })
    } catch (error: any) {
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'User is already a member' }, { status: 400 })
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

// DELETE: Remove a member from a conversation (kick)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const userId = await getAuthUser(req)
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: conversationId } = await params
    const { searchParams } = new URL(req.url)
    const targetUserId = searchParams.get('userId')

    if (!targetUserId) {
        return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 })
    }

    try {
        // Check if requester is the owner
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId }
        })

        if (!conversation) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
        }

        const isOwner = conversation.created_by === userId
        if (!isOwner) {
            return NextResponse.json({ error: 'Only the channel owner can kick members' }, { status: 403 })
        }

        if (targetUserId === userId) {
            return NextResponse.json({ error: 'Owner cannot kick themselves' }, { status: 400 })
        }

        // Remove member
        await prisma.conversationMember.delete({
            where: {
                conversation_id_user_id: {
                    conversation_id: conversationId,
                    user_id: targetUserId
                }
            }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
