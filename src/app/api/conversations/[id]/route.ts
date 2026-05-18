import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const payload = await verifyAuth(req)
        if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        const userId = payload.userId as string

        const { description, name } = await req.json()
        const { id: conversationId } = await params

        // Check if user is owner
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { members: true }
        })

        if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

        const isOwner = conversation.created_by === userId
        if (!isOwner) {
            console.log(`User ${userId} attempted to modify conversation ${conversationId} owned by ${conversation.created_by}`);
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const updatedConversation = await prisma.conversation.update({
            where: { id: conversationId },
            data: {
                description: description !== undefined ? description : conversation.description,
                name: name || conversation.name
            }
        })

        return NextResponse.json({ conversation: updatedConversation })

    } catch (error) {
        console.error('Update conversation error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const payload = await verifyAuth(req)
        if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        const userId = payload.userId as string
        const { id: conversationId } = await params

        // Don't allow leaving General Chat
        if (conversationId === '00000000-0000-0000-0000-000000000001') {
            return NextResponse.json({ error: 'Cannot leave General Chat' }, { status: 400 })
        }

        // Remove user from conversation
        await prisma.conversationMember.deleteMany({
            where: {
                conversation_id: conversationId,
                user_id: userId
            }
        })

        // Check if any members left
        const memberCount = await prisma.conversationMember.count({
            where: { conversation_id: conversationId }
        })

        if (memberCount === 0) {
            // Delete conversation if empty
            await prisma.conversation.delete({
                where: { id: conversationId }
            })
            return NextResponse.json({ success: true, deleted: true })
        }

        return NextResponse.json({ success: true, deleted: false })

    } catch (error) {
        console.error('Leave conversation error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
