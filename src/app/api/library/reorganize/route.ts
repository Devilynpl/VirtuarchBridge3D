import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getLibraryPath } from '@/lib/config';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

/**
 * POST /api/library/reorganize
 *
 * Physically reorganizes user's asset library into 3DBridge-compatible structure:
 *   LibraryRoot/
 *     Surface/
 *       asset_id/
 *         asset_id.json
 *         textures...
 *     3D/
 *       asset_id/
 *         ...
 *
 * This is OPTIONAL and user-initiated. By default 3DBridge works with
 * virtual folders and does NOT touch the disk layout.
 */
export async function POST(req: NextRequest) {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const LIBRARY_PATH = await getLibraryPath();
        if (!LIBRARY_PATH) return NextResponse.json({ error: 'Library path not set' }, { status: 500 });

        const assetsDataPath = path.join(LIBRARY_PATH, 'Data', 'assetsData.json');
        if (!existsSync(assetsDataPath)) {
            return NextResponse.json({ error: 'No assetsData.json found. Scan library first.' }, { status: 400 });
        }

        const rawData = await fs.readFile(assetsDataPath, 'utf-8');
        const assetsData = JSON.parse(rawData);

        let moved = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (const asset of assetsData) {
            if (!asset.id || !asset.path) { skipped++; continue; }

            const currentPath = Array.isArray(asset.path) ? path.join(LIBRARY_PATH, ...asset.path) : path.join(LIBRARY_PATH, asset.path);

            if (!existsSync(currentPath)) { skipped++; continue; }

            // Determine type folder
            const typeFolder = mapTypeToFolder(asset.type || 'unknown');
            const targetDir = path.join(LIBRARY_PATH, typeFolder, asset.id);

            // Skip if already in correct location
            const normalizedCurrent = path.resolve(currentPath).toLowerCase();
            const normalizedTarget = path.resolve(targetDir).toLowerCase();
            if (normalizedCurrent === normalizedTarget) { skipped++; continue; }

            // Skip if target already exists (avoid overwriting)
            if (existsSync(targetDir)) { skipped++; continue; }

            try {
                // Create the type folder if it doesn't exist
                await fs.mkdir(path.dirname(targetDir), { recursive: true });

                // Move the entire asset folder
                await fs.rename(currentPath, targetDir);
                moved++;
            } catch (e: any) {
                // If rename fails (cross-device), try copy + delete
                try {
                    await fs.cp(currentPath, targetDir, { recursive: true });
                    await fs.rm(currentPath, { recursive: true, force: true });
                    moved++;
                } catch (innerErr: any) {
                    errors.push(`${asset.id}: ${innerErr.message}`);
                }
            }
        }

        return NextResponse.json({
            success: true,
            moved,
            skipped,
            errors: errors.slice(0, 10),
            message: `Przeniesiono ${moved} assetów, pominięto ${skipped}. Odpal 'Sync Assets' aby odświeżyć indeks.`
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

function mapTypeToFolder(type: string): string {
    const mapping: Record<string, string> = {
        'surface': 'Surfaces',
        'atlas': 'Atlases',
        '3d': '3D_Assets',
        '3dplant': '3D_Plants',
        'brush': 'Brushes',
        'decal': 'Decals',
        'displacement': 'Displacements',
        'imperfection': 'Imperfections',
        'addon': 'Addons',
    };
    return mapping[type.toLowerCase()] || 'Other';
}
