import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getLibraryPath } from '@/lib/config';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface VirtualFolder {
    id: string;
    name: string;
    color: string;
    icon: string;
    assetIds: string[];
    createdAt: string;
}

async function getVFPath(): Promise<string | null> {
    const libPath = await getLibraryPath();
    if (!libPath) return null;
    const dataDir = path.join(libPath, 'Data');
    if (!existsSync(dataDir)) await fs.mkdir(dataDir, { recursive: true });
    return path.join(dataDir, 'virtual_folders.json');
}

async function readVF(): Promise<VirtualFolder[]> {
    const vfPath = await getVFPath();
    if (!vfPath || !existsSync(vfPath)) return [];
    try {
        const raw = await fs.readFile(vfPath, 'utf-8');
        return JSON.parse(raw);
    } catch (e) { return []; }
}

async function writeVF(folders: VirtualFolder[]): Promise<void> {
    const vfPath = await getVFPath();
    if (!vfPath) throw new Error('Library path not set');
    await fs.writeFile(vfPath, JSON.stringify(folders, null, 2), 'utf-8');
}

// GET — return all virtual folders
export async function GET(req: NextRequest) {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const folders = await readVF();
    return NextResponse.json({ folders });
}

// POST — create/update a virtual folder, or add/remove assets
export async function POST(req: NextRequest) {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const { action } = body;
        const folders = await readVF();

        if (action === 'create') {
            const { name, color, icon } = body;
            if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

            const newFolder: VirtualFolder = {
                id: crypto.randomUUID().split('-')[0],
                name,
                color: color || '#38bdf8',
                icon: icon || 'folder',
                assetIds: [],
                createdAt: new Date().toISOString()
            };
            folders.push(newFolder);
            await writeVF(folders);
            return NextResponse.json({ success: true, folder: newFolder });
        }

        if (action === 'add_asset') {
            const { folderId, assetId } = body;
            const folder = folders.find(f => f.id === folderId);
            if (!folder) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
            if (!folder.assetIds.includes(assetId)) {
                folder.assetIds.push(assetId);
            }
            await writeVF(folders);
            return NextResponse.json({ success: true, folder });
        }

        if (action === 'remove_asset') {
            const { folderId, assetId } = body;
            const folder = folders.find(f => f.id === folderId);
            if (!folder) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
            folder.assetIds = folder.assetIds.filter(id => id !== assetId);
            await writeVF(folders);
            return NextResponse.json({ success: true, folder });
        }

        if (action === 'rename') {
            const { folderId, name, color } = body;
            const folder = folders.find(f => f.id === folderId);
            if (!folder) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
            if (name) folder.name = name;
            if (color) folder.color = color;
            await writeVF(folders);
            return NextResponse.json({ success: true, folder });
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// DELETE — delete a virtual folder
export async function DELETE(req: NextRequest) {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get('id');
    if (!folderId) return NextResponse.json({ error: 'Missing folder id' }, { status: 400 });

    const folders = await readVF();
    const newFolders = folders.filter(f => f.id !== folderId);
    await writeVF(newFolders);
    return NextResponse.json({ success: true });
}
