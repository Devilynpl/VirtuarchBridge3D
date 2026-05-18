import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { verifyAuth } from '@/lib/auth';
import { getLibraryPath } from '@/lib/config';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export async function POST(req: NextRequest) {
    try {
        const user = await verifyAuth(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { assetIds, key } = await req.json();
        if (!assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
            return NextResponse.json({ error: 'Invalid assetIds' }, { status: 400 });
        }

        const LIBRARY_PATH = await getLibraryPath();
        if (!LIBRARY_PATH) return NextResponse.json({ error: 'Library path not set' }, { status: 500 });

        const id = assetIds[0];

        // Process a single asset at a time based on the new logic
        const assetFolder = await findAssetFolder(LIBRARY_PATH, id);
        if (!assetFolder) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

        const parentDir = path.dirname(assetFolder);
        const folderName = path.basename(assetFolder);

        const zipFileName = `${id}encrypted.zip`;
        const tempZipPath = path.join(parentDir, zipFileName);

        // Delete previous if it somehow exists
        await fs.unlink(tempZipPath).catch(() => { });

        let packCmd = key ?
            `zip -P "${key}" -r "${id}encrypted.zip" "${folderName}"` :
            `zip -r "${id}encrypted.zip" "${folderName}"`;

        console.log("Executing pack command:", packCmd);

        try {
            await execPromise(packCmd, { cwd: parentDir });
        } catch (execError: any) {
            console.error('Exec pack error:', execError);
            return NextResponse.json({ error: 'Failed to run packing command' }, { status: 500 });
        }

        // Save to a temporary transfer folder for downloads
        const transferDir = path.join(LIBRARY_PATH, 'transfers');
        await fs.mkdir(transferDir, { recursive: true });

        const finalFilePath = path.join(transferDir, zipFileName);

        // Move the packed zip from its original directory into transfers
        await fs.rename(tempZipPath, finalFilePath);

        const stats = await fs.stat(finalFilePath);

        return NextResponse.json({
            success: true,
            fileName: zipFileName,
            size: stats.size
        });
    } catch (err: any) {
        console.error('Pack Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

async function findAssetFolder(base: string, id: string): Promise<string | null> {
    const items = await fs.readdir(base, { withFileTypes: true });
    for (const item of items) {
        if (item.isDirectory()) {
            if (item.name.toLowerCase() === id.toLowerCase()) {
                return path.join(base, item.name);
            }
            // Shallow recursive search (Megascans usually has 1-2 levels max: type/id)
            const subPath = path.join(base, item.name);
            const subItems = await fs.readdir(subPath, { withFileTypes: true });
            for (const sub of subItems) {
                if (sub.isDirectory() && sub.name.toLowerCase() === id.toLowerCase()) {
                    return path.join(subPath, sub.name);
                }
            }
        }
    }
    return null;
}

