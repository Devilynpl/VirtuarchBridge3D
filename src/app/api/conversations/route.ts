import prisma from '../../../lib/prisma'
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

const PUBLIC_CONV_ID = '00000000-0000-0000-0000-000000000001';

export async function GET(req: NextRequest) {
    const userId = await getAuthUser(req)
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const conversations = await prisma.conversation.findMany({
            where: {
                OR: [
                    { id: PUBLIC_CONV_ID },
                    {
                        members: {
                            some: { user_id: userId }
                        }
                    }
                ]
            },
            include: {
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                avatar_url: true,
                                status: true
                            }
                        }
                    }
                },
                messages: {
                    orderBy: { created_at: 'desc' },
                    take: 1,
                    include: {
                        sender: {
                            select: {
                                id: true,
                                username: true
                            }
                        }
                    }
                }
            },
            orderBy: { updated_at: 'desc' }
        })

        return NextResponse.json({ conversations })
    } catch (error) {
        console.error('Fetch conversations error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    const userId = await getAuthUser(req)
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { type, name, description, is_private, member_ids } = await req.json()

        if (!type) {
            return NextResponse.json({ error: 'Missing required field: type' }, { status: 400 })
        }

        if (type === 'direct') {
            if (!member_ids || member_ids.length === 0) {
                return NextResponse.json({ error: 'Missing member_ids for direct message' }, { status: 400 })
            }

            const otherUserId = member_ids[0]

            // Check if DM already exists
            const existingDM = await prisma.conversation.findFirst({
                where: {
                    type: 'direct',
                    AND: [
                        { members: { some: { user_id: userId } } },
                        { members: { some: { user_id: otherUserId } } }
                    ]
                },
                include: {
                    members: true
                }
            })

            if (existingDM) {
                return NextResponse.json({ conversation: existingDM })
            }

            // Create new DM
            const conversation = await prisma.conversation.create({
                data: {
                    type: 'direct',
                    members: {
                        create: [
                            { user_id: userId, role: 'member' },
                            { user_id: otherUserId, role: 'member' }
                        ]
                    }
                },
                include: {
                    members: true
                }
            })

            return NextResponse.json({ conversation }, { status: 201 })

        } else if (type === 'channel') {
            if (!name) {
                return NextResponse.json({ error: 'Missing required field: name' }, { status: 400 })
            }

            const conversation = await prisma.conversation.create({
                data: {
                    type: 'channel',
                    name,
                    description,
                    is_private: is_private || false,
                    created_by: userId,
                    members: {
                        create: [
                            { user_id: userId, role: 'owner' },
                            ...(member_ids || []).map((mId: string) => ({
                                user_id: mId,
                                role: 'member'
                            }))
                        ]
                    }
                },
                include: {
                    members: true
                }
            })

            return NextResponse.json({ conversation }, { status: 201 })
        }

        return NextResponse.json({ error: 'Invalid conversation type' }, { status: 400 })

    } catch (error) {
        console.error('Create conversation error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
