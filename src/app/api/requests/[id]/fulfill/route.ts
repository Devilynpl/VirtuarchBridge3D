import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { verifyAuth } from '@/lib/auth'

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = await verifyAuth(req)
    const userId = user?.userId as string | undefined

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: requestId } = await params

    try {
        const formData = await req.formData()
        const file = formData.get('file') as File

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        const request = await prisma.assetRequest.findUnique({
            where: { id: requestId },
            include: { message: true }
        })

        if (!request) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 })
        }

        if (request.status !== 'pending') {
            return NextResponse.json({ error: 'Request already fulfilled or cancelled' }, { status: 400 })
        }

        // Check membership
        const member = await prisma.conversationMember.findUnique({
            where: {
                conversation_id_user_id: {
                    conversation_id: request.conversation_id,
                    user_id: userId
                }
            }
        })

        const PUBLIC_CONV_ID = '00000000-0000-0000-0000-000000000001';
        if (!member && request.conversation_id !== PUBLIC_CONV_ID) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Save file to a storage directory
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'fulfilled')
        await mkdir(uploadDir, { recursive: true })

        // 1. Sanitize filename to strict safe characters
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const fileName = `${Date.now()}-${safeName}`

        // 2. Resolve final path to check for traversal attempts
        const absoluteUploadDir = path.resolve(uploadDir);
        const filePath = path.resolve(uploadDir, fileName)

        // 3. Verify it is strictly inside uploadDir
        if (!filePath.startsWith(absoluteUploadDir)) {
            return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })
        }

        const publicPath = `/uploads/fulfilled/${fileName}`

        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)
        await writeFile(filePath, buffer)

        // Update database
        const updatedRequest = await prisma.assetRequest.update({
            where: { id: requestId },
            data: {
                status: 'fulfilled',
                fulfilled_by: userId,
                fulfilled_path: publicPath,
                fulfilled_at: new Date()
            },
            include: {
                fulfiller: { select: { username: true } }
            }
        })

        // Update the original message metadata
        const currentMetadata = request.message.metadata ? JSON.parse(request.message.metadata) : {}
        const updatedMetadata = {
            ...currentMetadata,
            status: 'fulfilled',
            fulfillerName: updatedRequest.fulfiller?.username,
            filePath: publicPath,
            fileName: file.name
        }

        const updatedMessage = await prisma.message.update({
            where: { id: request.message_id },
            data: {
                metadata: JSON.stringify(updatedMetadata)
            },
            include: {
                sender: { select: { id: true, username: true, avatar_url: true } }
            }
        })

        // Broadcast the update via Socket.io
        // @ts-ignore
        if (global.io) {
            // @ts-ignore
            global.io.to(request.conversation_id).emit('message_updated', updatedMessage);
        }

        return NextResponse.json({ request: updatedRequest })
    } catch (error) {
        console.error('Fulfillment error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
