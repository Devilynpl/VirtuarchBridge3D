import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { verifyAuth } from '@/lib/auth';
import { getLibraryPath, getConfig } from '@/lib/config';
import { unpackAsset } from '@/lib/unpacker';

const BLENDER_SERVER_URL = process.env.NEXT_PUBLIC_BLENDER_URL || 'http://127.0.0.1:28888';

export async function POST(req: NextRequest) {
    try {
        const user = await verifyAuth(req);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const LIBRARY_PATH = await getLibraryPath();
        const config = await getConfig();
        const exportTarget = config.exportTarget || 'blender';

        if (!LIBRARY_PATH) {
            return NextResponse.json({ error: 'Library path not configured' }, { status: 500 });
        }

        const assetData = await req.json();
        const jsonPath = assetData.jsonPath;

        if (!jsonPath) {
            return NextResponse.json({ error: 'Missing jsonPath' }, { status: 400 });
        }

        // Path vaildation: ensure it is within the Megascans Library
        const resolvedPath = path.resolve(jsonPath);
        const resolvedLibraryPath = path.resolve(LIBRARY_PATH);

        if (!resolvedPath.startsWith(resolvedLibraryPath)) {
            return NextResponse.json({ error: 'Unauthorized path access. Traversal blocked.' }, { status: 403 });
        }

        if (!existsSync(jsonPath)) {
            return NextResponse.json({ error: 'Asset metadata not found' }, { status: 404 });
        }

        const rawJson = await fs.readFile(jsonPath, 'utf-8');
        const metadata = JSON.parse(rawJson);

        if (exportTarget === 'unreal') {
            const unrealPath = config.unrealPath;
            if (!unrealPath) {
                return NextResponse.json({ error: 'Unreal Engine project path is not configured in settings.' }, { status: 400 });
            }

            if (!existsSync(unrealPath)) {
                return NextResponse.json({ error: 'Unreal Engine project path does not exist.' }, { status: 400 });
            }
            const safeType = (assetData.type || 'Other').replace(/[^a-zA-Z0-9]/g, '_');
            const safeName = (assetData.name || assetData.id).replace(/[^a-zA-Z0-9_]/g, '_');

            const destDir = path.join(unrealPath, '3dbridge', safeType, safeName);

            console.log(`Exporting to Unreal Engine: Copying to ${destDir}`);
            await fs.mkdir(destDir, { recursive: true });

            // Copy the asset directory contents
            // Note: In newer Node.js, fs.cp allows recursive copying
            await fs.cp(assetData.path, destDir, { recursive: true });

            return NextResponse.json({ success: true, message: 'Copied to Unreal project successfully' });
        } else if (exportTarget === 'unity') {
            const UNITY_SERVER_URL = 'http://127.0.0.1:28889/import';

            const payload = {
                id: assetData.id,
                name: assetData.name,
                type: assetData.type,
                path: assetData.path,
                selectedResolution: assetData.selectedResolution,
                decimation: assetData.decimation,
                metadata: metadata
            };

            console.log(`Forwarding export request to Unity: ${UNITY_SERVER_URL}`);

            const response = await fetch(UNITY_SERVER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                cache: 'no-store'
            });

            if (!response.ok) {
                const text = await response.text();
                console.error(`Unity responded with ${response.status}: ${text}`);
                throw new Error(`Unity listener returned ${response.status}: ${text}`);
            }

            return NextResponse.json({ success: true, message: 'Exported to Unity successfully' });
        }

        // Check if this is a master file (.blend, .fbx, .obj) or encrypted package (.ass, .asset)
        const isMasterFile = assetData.type === 'blend' || assetData.type === 'fbx' || assetData.type === 'obj_file';
        const masterFileName = assetData.masterFile || metadata?.masterFile;
        const isEncryptedPackage = masterFileName && /\.(ass|asset)$/i.test(masterFileName);

        // ═══════════════════════════════════════════════════════════
        //  .ASS / .ASSET v2.0 — Universal Unpacker Pipeline
        //  Decrypt → Decompress → Export to DCC tool
        // ═══════════════════════════════════════════════════════════
        if (isEncryptedPackage) {
            const packagePath = path.join(assetData.path, masterFileName);

            if (!existsSync(packagePath)) {
                return NextResponse.json({ error: `Encrypted package not found: ${masterFileName}` }, { status: 404 });
            }

            console.log(`[Export] Unpacking encrypted package: ${packagePath}`);
            const unpackResult = await unpackAsset(packagePath);

            // Schedule cleanup after 5 minutes
            setTimeout(() => unpackResult.cleanup(), 5 * 60 * 1000);

            if (exportTarget === 'unreal') {
                const unrealPath = config.unrealPath;
                if (!unrealPath) {
                    return NextResponse.json({ error: 'Unreal Engine project path is not configured.' }, { status: 400 });
                }
                const safeType = (assetData.type || 'Other').replace(/[^a-zA-Z0-9]/g, '_');
                const safeName = (assetData.name || assetData.id).replace(/[^a-zA-Z0-9_]/g, '_');
                const destDir = path.join(unrealPath, '3dbridge', safeType, safeName);

                await fs.mkdir(destDir, { recursive: true });
                await fs.cp(unpackResult.tempDir, destDir, { recursive: true });

                return NextResponse.json({
                    success: true,
                    message: `Decrypted & copied ${unpackResult.files.length} files to Unreal project`,
                    filesCount: unpackResult.files.length,
                    totalSize: unpackResult.totalSize
                });
            }

            // Default: Send unpacked directory to Blender
            const payload = {
                action: 'import_unpacked',
                filepath: unpackResult.tempDir,
                name: assetData.name,
                type: assetData.type,
                files: unpackResult.files,
                assetCode: unpackResult.assetCode
            };

            console.log(`[Export] Forwarding unpacked ${unpackResult.files.length} files to Blender`);

            const response = await fetch(BLENDER_SERVER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                cache: 'no-store'
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Blender listener returned ${response.status}: ${text}`);
            }

            return NextResponse.json({
                success: true,
                message: `Decrypted & sent ${unpackResult.files.length} files to Blender`,
                filesCount: unpackResult.files.length,
                totalSize: unpackResult.totalSize
            });
        }

        if (isMasterFile && exportTarget === 'blender') {
            // For .blend files: send open/append command directly to Blender
            const masterFilePath = masterFileName
                ? path.join(assetData.path, masterFileName)
                : assetData.path;

            const action = assetData.type === 'blend' ? 'open_blend' : 'import_fbx';

            const payload = {
                action,
                filepath: masterFilePath,
                name: assetData.name,
                type: assetData.type
            };

            console.log(`[Export] Master file ${action}: ${masterFilePath}`);

            const response = await fetch(BLENDER_SERVER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                cache: 'no-store'
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Blender listener returned ${response.status}: ${text}`);
            }

            return NextResponse.json({ success: true, message: `${action} sent to Blender` });
        }

        // Default: Prepare payload for Blender (standard texture assets)
        const payload = {
            id: assetData.id,
            name: assetData.name,
            type: assetData.type,
            path: assetData.path,
            selectedResolution: assetData.selectedResolution,
            decimation: assetData.decimation,
            metadata: metadata
        };

        console.log(`Forwarding export request to: ${BLENDER_SERVER_URL}`);

        // Forward to Blender's local listener
        const response = await fetch(BLENDER_SERVER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            cache: 'no-store'
        });

        if (!response.ok) {
            const text = await response.text();
            console.error(`Blender responded with ${response.status}: ${text}`);
            throw new Error(`Blender listener returned ${response.status}: ${text}`);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Export API Error:', error);
        return NextResponse.json({
            error: error.message || 'Export failed',
            details: error.stack
        }, { status: 500 });
    }
}
