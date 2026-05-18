import prisma from '../../../../lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization')
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const token = authHeader.split(' ')[1]
        const decoded = await verifyToken(token);

        if (!decoded?.userId) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
        }

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId as string }
        })

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const { password_hash, ...userResult } = user
        return NextResponse.json({ user: userResult })

    } catch (error) {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }
}
