import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { getAssets, generateAssetsData } from '@/lib/assets';

export async function POST(req: Request) {
    try {
        const payload = await verifyAuth(req);
        if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const userId = payload.userId as string;

        // 1. Get assets from already-cached assetsData.json (fast, no filesystem walk)
        let localAssets = await getAssets();

        // 1b. Only if cache doesn't exist yet: generate it (full filesystem walk)
        if (localAssets.length === 0) {
            localAssets = await generateAssetsData();
        }

        if (localAssets.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No assets found to sync. Check your library path.',
                count: 0
            });
        }

        // 2. Build asset data — thumbnail served via ?path= with absolute local path
        const assetData = localAssets.map(asset => ({
            user_id: userId,
            asset_id: asset.id,
            name: asset.name,
            type: asset.type,
            categories: asset.categories,
            tags: asset.tags,
            thumbnail: asset.thumbnail
                ? `/api/assets/thumbnail?path=${encodeURIComponent(asset.thumbnail)}`
                : null
        }));

        // 3. Replace user's assets in DB (chunked to avoid SQLite variable limits)
        await prisma.userAsset.deleteMany({ where: { user_id: userId } });

        const chunkSize = 200;
        for (let j = 0; j < assetData.length; j += chunkSize) {
            await prisma.userAsset.createMany({
                data: assetData.slice(j, j + chunkSize)
            });
            // Yield event loop between DB writes
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        return NextResponse.json({
            success: true,
            message: `Successfully synced ${localAssets.length} assets`,
            count: localAssets.length
        });

    } catch (error) {
        console.error('Scan library error:', error);
        return NextResponse.json({
            error: 'Internal server error: ' + (error instanceof Error ? error.message : String(error))
        }, { status: 500 });
    }
}
