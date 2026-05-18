import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getLibraryPath } from '@/lib/config';
import fs from 'fs/promises';
import { createWriteStream, existsSync } from 'fs';
import path from 'path';
import archiver from 'archiver';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
    try {
        const user = await verifyAuth(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { assetIds } = await req.json();
        if (!assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
            return NextResponse.json({ error: 'No assets provided.' }, { status: 400 });
        }

        const LIBRARY_PATH = await getLibraryPath();
        if (!LIBRARY_PATH) return NextResponse.json({ error: 'Library path not set' }, { status: 500 });

        // Generate unique link ID and a password
        const shareId = crypto.randomUUID().split('-')[0]; // short uuid
        const password = crypto.randomBytes(4).toString('hex'); // 8 chars

        const shareDir = path.join(LIBRARY_PATH, 'shares');
        await fs.mkdir(shareDir, { recursive: true });

        const zipPath = path.join(shareDir, `${shareId}.zip`);
        const metaPath = path.join(shareDir, `${shareId}.json`);

        // Wait for the zip to finish packing
        await new Promise<void>(async (resolve, reject) => {
            const output = createWriteStream(zipPath);
            const archive = archiver('zip', { zlib: { level: 5 } }); // Level 5 for balance

            output.on('close', () => resolve());
            archive.on('error', (err) => reject(err));

            archive.pipe(output);

            const allMetadata = JSON.parse(await fs.readFile(path.join(LIBRARY_PATH, 'Data', 'assets.json'), 'utf-8'));

            for (const assetId of assetIds) {
                const asset = allMetadata.find((a: any) => a.id === assetId);
                if (asset && existsSync(asset.path)) {
                    // Make sure they don't escape base dir
                    const resolvedPath = path.resolve(asset.path);
                    if (resolvedPath.startsWith(path.resolve(LIBRARY_PATH))) {
                        archive.directory(asset.path, asset.name || asset.id);
                    }
                }
            }

            archive.finalize();
        });

        const stats = await fs.stat(zipPath);

        // Hash the password so even if someone reads JSON they don't easily get it
        // but for simplicity, we just save plaintext since it's local only app
        const metadata = {
            id: shareId,
            password: password,
            createdBy: user.userId,
            createdAt: new Date().toISOString(),
            size: stats.size,
            assetCount: assetIds.length
        };

        await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');

        // Link logic, usually local IP for the LAN setup
        // Let frontend figure out window.location.origin
        const sharePath = `/share/${shareId}`;

        return NextResponse.json({
            success: true,
            shareId,
            password,
            sharePath
        });

    } catch (error: any) {
        console.error('Share Link API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
