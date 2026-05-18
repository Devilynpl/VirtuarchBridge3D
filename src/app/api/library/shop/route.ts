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

export async function POST(req: Request) {
    const userId = await getUserIdFromReq(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const { asset_id, is_for_sale, price } = await req.json()

        if (!asset_id) {
            return NextResponse.json({ error: 'asset_id is required' }, { status: 400 })
        }

        const asset = await prisma.userAsset.findFirst({
            where: { user_id: userId, asset_id }
        });

        if (!asset) {
            return NextResponse.json({ error: 'Asset not found in your library' }, { status: 404 });
        }

        const updated = await prisma.userAsset.update({
            where: { id: asset.id },
            data: {
                is_for_sale: !!is_for_sale,
                price: price ? parseInt(price, 10) : 0
            }
        });

        return NextResponse.json({ success: true, asset: updated })
    } catch (error) {
        console.error('Shop update error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
