import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getAssets } from '@/lib/assets';

function formatBytes(bytes: number, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const assets = await getAssets();
        const asset = assets.find(a => a.id === id);

        if (!asset) {
            return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
        }

        const assetDir = asset.path;
        const result = [];

        try {
            const files = await fs.readdir(assetDir, { withFileTypes: true });
            for (const file of files) {
                if (file.isFile()) {
                    const filePath = path.join(assetDir, file.name);
                    const stats = await fs.stat(filePath);
                    result.push({
                        name: file.name,
                        sizeBytes: stats.size,
                        sizeStr: formatBytes(stats.size),
                    });
                }
            }
        } catch (e) {
            console.error('Failed reading directory', e);
        }

        return NextResponse.json({ files: result });

    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Error occurred' }, { status: 500 });
    }
}
