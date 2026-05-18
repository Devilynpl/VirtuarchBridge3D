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

    // Phase 5: Check basic body size / entry count
    const contentLength = parseInt(req.headers.get('content-length') || '0');
    if (contentLength > 10 * 1024 * 1024) { // 10MB limit for JSON
        return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    try {
        const { assets } = await req.json()

        if (!Array.isArray(assets)) {
            return NextResponse.json({ error: 'Invalid assets data' }, { status: 400 })
        }

        const existingAssets = await prisma.userAsset.findMany({
            where: { user_id: userId }
        });
        const existingMap = new Map();
        existingAssets.forEach(a => existingMap.set(a.asset_id, a));

        const ops = [];
        const seenIds = new Set();
        for (const a of assets) {
            seenIds.add(a.id);
            if (existingMap.has(a.id)) {
                ops.push(prisma.userAsset.update({
                    where: { id: existingMap.get(a.id).id },
                    data: {
                        name: a.name,
                        type: a.type,
                        categories: a.categories || [],
                        tags: a.tags || [],
                        thumbnail: a.thumbnail
                    }
                }));
            } else {
                ops.push(prisma.userAsset.create({
                    data: {
                        user_id: userId,
                        asset_id: a.id,
                        name: a.name,
                        type: a.type,
                        categories: a.categories || [],
                        tags: a.tags || [],
                        thumbnail: a.thumbnail
                    }
                }));
            }
        }

        const toDeleteIds = existingAssets.filter(ea => !seenIds.has(ea.asset_id)).map(ea => ea.id);
        if (toDeleteIds.length > 0) {
            ops.push(prisma.userAsset.deleteMany({
                where: { id: { in: toDeleteIds } }
            }));
        }

        await prisma.$transaction(ops);

        return NextResponse.json({ success: true, count: assets.length })
    } catch (error) {
        console.error('Library sync error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
