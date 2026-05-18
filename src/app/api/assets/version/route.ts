import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getLibraryPath } from '@/lib/config';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

interface VersionEntry {
    version: number;
    timestamp: string;
    author: string;
    hash: string;
    changes: string;
}

async function hashDirectory(dirPath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        const files = entries.filter(e => e.isFile() && !e.name.endsWith('.versions.json'));
        files.sort((a, b) => a.name.localeCompare(b.name));

        for (const file of files) {
            const filePath = path.join(dirPath, file.name);
            const stat = await fs.stat(filePath);
            // Hash filename + size + mtime for speed (no need to read entire textures)
            hash.update(`${file.name}:${stat.size}:${stat.mtimeMs}`);
        }
    } catch (e) {
        hash.update('empty');
    }
    return hash.digest('hex').slice(0, 16);
}

function getVersionsPath(assetPath: string, assetId: string) {
    return path.join(assetPath, `${assetId}.versions.json`);
}

async function readVersions(versionsPath: string): Promise<VersionEntry[]> {
    try {
        if (existsSync(versionsPath)) {
            const raw = await fs.readFile(versionsPath, 'utf-8');
            return JSON.parse(raw);
        }
    } catch (e) { }
    return [];
}

// GET — fetch version history for an asset
export async function GET(req: NextRequest) {
    try {
        const user = await verifyAuth(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const assetPath = searchParams.get('path');
        const assetId = searchParams.get('id');

        if (!assetPath || !assetId) {
            return NextResponse.json({ error: 'Missing path or id' }, { status: 400 });
        }

        const LIBRARY_PATH = await getLibraryPath();
        if (!LIBRARY_PATH) return NextResponse.json({ error: 'Library path not set' }, { status: 500 });

        // Security: path traversal check
        const resolved = path.resolve(assetPath);
        if (!resolved.startsWith(path.resolve(LIBRARY_PATH))) {
            return NextResponse.json({ error: 'Path traversal blocked' }, { status: 403 });
        }

        const versionsPath = getVersionsPath(assetPath, assetId);
        const versions = await readVersions(versionsPath);
        const currentHash = await hashDirectory(assetPath);

        // Check if files changed since last version
        const lastVersion = versions.length > 0 ? versions[versions.length - 1] : null;
        const hasUncommitted = lastVersion ? lastVersion.hash !== currentHash : versions.length === 0;

        return NextResponse.json({
            versions,
            currentHash,
            hasUncommitted,
            latestVersion: lastVersion?.version || 0
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// POST — commit a new version (bump)
export async function POST(req: NextRequest) {
    try {
        const user = await verifyAuth(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { assetPath, assetId, changes } = await req.json();
        if (!assetPath || !assetId) {
            return NextResponse.json({ error: 'Missing assetPath or assetId' }, { status: 400 });
        }

        const LIBRARY_PATH = await getLibraryPath();
        if (!LIBRARY_PATH) return NextResponse.json({ error: 'Library path not set' }, { status: 500 });

        const resolved = path.resolve(assetPath);
        if (!resolved.startsWith(path.resolve(LIBRARY_PATH))) {
            return NextResponse.json({ error: 'Path traversal blocked' }, { status: 403 });
        }

        const versionsPath = getVersionsPath(assetPath, assetId);
        const versions = await readVersions(versionsPath);
        const currentHash = await hashDirectory(assetPath);

        // Check if anything actually changed
        const lastVersion = versions.length > 0 ? versions[versions.length - 1] : null;
        if (lastVersion && lastVersion.hash === currentHash) {
            return NextResponse.json({ error: 'No changes detected since last version.' }, { status: 409 });
        }

        const newVersion: VersionEntry = {
            version: (lastVersion?.version || 0) + 1,
            timestamp: new Date().toISOString(),
            author: (user as any).username || 'Unknown',
            hash: currentHash,
            changes: changes || `Version ${(lastVersion?.version || 0) + 1} committed`
        };

        versions.push(newVersion);
        await fs.writeFile(versionsPath, JSON.stringify(versions, null, 2), 'utf-8');

        // Emit socket event if available for P2P notifications
        try {
            const io = (global as any).io;
            if (io) {
                io.emit('asset_version_update', {
                    assetId,
                    version: newVersion.version,
                    author: newVersion.author,
                    changes: newVersion.changes,
                    timestamp: newVersion.timestamp
                });
            }
        } catch (e) { /* socket not available, no problem */ }

        return NextResponse.json({
            success: true,
            version: newVersion
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
