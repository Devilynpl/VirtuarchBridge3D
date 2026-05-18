import { NextRequest, NextResponse } from 'next/server';
import { getAssets } from '@/lib/assets';
import { verifyAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
    const user = await verifyAuth(req);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');

    if (!code) {
        return NextResponse.json({ error: 'Missing code' }, { status: 400 });
    }

    try {
        const assets = await getAssets();
        const asset = assets.find(a => a.id === code);

        if (!asset) {
            return NextResponse.json({ valid: false }, { status: 404 });
        }

        return NextResponse.json({
            valid: true,
            asset: {
                id: asset.id,
                name: asset.name,
                code: asset.id,
                thumbnail: asset.thumbnail ? `/api/assets/thumbnail?path=${encodeURIComponent(asset.thumbnail)}` : null
            }
        });
    } catch (error) {
        console.error('Validate asset error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
