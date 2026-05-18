import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { verifyAuth } from '@/lib/auth';
import { getLibraryPath } from '@/lib/config';

export async function GET(req: NextRequest) {
    const user = await verifyAuth(req);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const assetPath = searchParams.get('path');

    if (!assetPath) {
        return NextResponse.json({ error: 'Missing path' }, { status: 400 });
    }

    try {
        const libraryPath = await getLibraryPath();
        if (!libraryPath) {
            return NextResponse.json({ error: 'Library path not configured' }, { status: 500 });
        }

        const resolvedPath = path.resolve(assetPath);
        const resolvedLibraryPath = path.resolve(libraryPath);

        // Case-insensitive check for Windows paths
        if (!resolvedPath.toLowerCase().startsWith(resolvedLibraryPath.toLowerCase())) {
            return NextResponse.json({ error: 'Unauthorized path access. Traversal blocked.' }, { status: 403 });
        }

        if (!existsSync(assetPath)) {
            return NextResponse.json({ error: 'Asset path not found' }, { status: 404 });
        }

        const files = await fs.readdir(assetPath);
        const resolutions = new Set<string>();

        files.forEach(file => {
            const lower = file.toLowerCase();
            if (lower.match(/_1k_/) || lower.match(/1k/) || lower.match(/1024/)) resolutions.add('1K');
            if (lower.match(/_2k_/) || lower.match(/2k/) || lower.match(/2048/)) resolutions.add('2K');
            if (lower.match(/_4k_/) || lower.match(/4k/) || lower.match(/4096/)) resolutions.add('4K');
            if (lower.match(/_8k_/) || lower.match(/8k/) || lower.match(/8192/)) resolutions.add('8K');
        });

        // Fallback for custom assets without explicit tags
        if (resolutions.size === 0) {
            const hasImages = files.some(f => f.toLowerCase().match(/\.(jpg|png|exr|tga)$/));
            if (hasImages) resolutions.add('ORIGINAL');
        }

        const sortedRes = Array.from(resolutions).sort((a, b) => {
            if (a === 'ORIGINAL') return -1;
            return parseInt(a) - parseInt(b);
        });

        return NextResponse.json({ resolutions: sortedRes });
    } catch (error: any) {
        console.error('Resolutions API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch resolutions' }, { status: 500 });
    }
}
