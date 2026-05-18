import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { verifyAuth } from '@/lib/auth';
import { getLibraryPath } from '@/lib/config';

export async function GET(req: NextRequest) {
    try {
        const user = await verifyAuth(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const fileName = req.nextUrl.searchParams.get('file');
        if (!fileName) return NextResponse.json({ error: 'Missing filename' }, { status: 400 });

        const LIBRARY_PATH = await getLibraryPath();
        if (!LIBRARY_PATH) return NextResponse.json({ error: 'Library path not set' }, { status: 500 });

        const filePath = path.join(LIBRARY_PATH, 'transfers', fileName);
        const buffer = await fs.readFile(filePath);

        // Auto-delete the zip from the sender's system after loading it into memory
        await fs.unlink(filePath).catch(() => { });

        return new Response(buffer, {
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="${fileName}"`
            }
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
