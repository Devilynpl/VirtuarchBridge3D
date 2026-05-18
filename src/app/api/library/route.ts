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

export async function DELETE(req: Request) {
    const userId = await getUserIdFromReq(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        // Delete all assets for this user
        await prisma.userAsset.deleteMany({
            where: { user_id: userId }
        })

        return NextResponse.json({ success: true, message: 'Library assets cleared' })
    } catch (error) {
        console.error('Library deletion error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function GET(req: Request) {
    const userId = await getUserIdFromReq(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const assets = await prisma.userAsset.findMany({
            where: { user_id: userId },
            select: { asset_id: true, is_for_sale: true, price: true }
        })
        return NextResponse.json({ assets })
    } catch (error) {
        console.error('Library fetching error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
