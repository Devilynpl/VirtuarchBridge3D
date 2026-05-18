import { NextResponse } from 'next/server';
import { getAssets } from '@/lib/assets';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const assets = await getAssets();
        const asset = assets.find(a => a.id === id);

        if (!asset) {
            return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
        }

        return NextResponse.json(asset);
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Error occurred' }, { status: 500 });
    }
}
