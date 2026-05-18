import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { verifyAuth } from '@/lib/auth';
import { getLibraryPath } from '@/lib/config';

export async function GET(req: NextRequest) {
    try {
        const user = await verifyAuth(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const LIBRARY_PATH = await getLibraryPath();
        if (!LIBRARY_PATH) return NextResponse.json({ count: 0 });

        const transferDir = path.join(LIBRARY_PATH, 'transfers');
        if (!(await exists(transferDir))) return NextResponse.json({ count: 0 });

        const files = await fs.readdir(transferDir);
        const zipFiles = files.filter(f => f.toLowerCase().endsWith('.zip'));

        return NextResponse.json({
            count: zipFiles.length,
            files: zipFiles
        });
    } catch (err) {
        return NextResponse.json({ count: 0 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const user = await verifyAuth(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const LIBRARY_PATH = await getLibraryPath();
        if (!LIBRARY_PATH) return NextResponse.json({ success: true });

        const transferDir = path.join(LIBRARY_PATH, 'transfers');
        if (!(await exists(transferDir))) return NextResponse.json({ success: true });

        const files = await fs.readdir(transferDir);
        for (const file of files) {
            if (file.toLowerCase().endsWith('.zip')) {
                await fs.unlink(path.join(transferDir, file));
            }
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

async function exists(p: string) {
    try {
        await fs.access(p);
        return true;
    } catch {
        return false;
    }
}
