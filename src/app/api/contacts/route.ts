import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

import { JWT_SECRET } from '@/lib/auth';

async function getUserIdFromReq(req: Request) {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return null
    const token = authHeader.split(' ')[1]
    try {
        const decoded: any = jwt.verify(token, JWT_SECRET)
        return decoded.userId
    } catch (e) {
        return null
    }
}

export async function GET(req: Request) {
    const userId = await getUserIdFromReq(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const contacts = await prisma.userContact.findMany({
            where: { user_id: userId },
            include: {
                contact: {
                    select: {
                        id: true,
                        username: true,
                        peer_id: true,
                        status: true,
                    }
                }
            },
            orderBy: { created_at: 'desc' }
        })

        return NextResponse.json({ contacts })
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    const userId = await getUserIdFromReq(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const { peer_id, alias } = await req.json()

        if (!peer_id) return NextResponse.json({ error: 'Peer ID is required' }, { status: 400 })

        const contactUser = await prisma.user.findUnique({
            where: { peer_id }
        })

        if (!contactUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })
        if (contactUser.id === userId) return NextResponse.json({ error: 'Cannot add yourself' }, { status: 400 })

        const contact = await prisma.userContact.create({
            data: {
                user_id: userId,
                contact_id: contactUser.id,
                alias: alias || contactUser.username
            },
            include: {
                contact: {
                    select: {
                        id: true,
                        username: true,
                        peer_id: true,
                        status: true,
                    }
                }
            }
        })

        return NextResponse.json({ contact })
    } catch (error: any) {
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'User already in contacts' }, { status: 400 })
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function DELETE(req: Request) {
    const userId = await getUserIdFromReq(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(req.url);
        const contact_id = searchParams.get('id');

        if (!contact_id) return NextResponse.json({ error: 'Contact ID is required' }, { status: 400 });

        await prisma.userContact.deleteMany({
            where: {
                user_id: userId,
                contact_id: contact_id
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
