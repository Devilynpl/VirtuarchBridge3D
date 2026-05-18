import { NextRequest, NextResponse } from 'next/server';
import { getLibraryPath } from '@/lib/config';
import fs from 'fs/promises';
import { createReadStream, existsSync } from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const shareId = searchParams.get('id');
        const submittedPassword = searchParams.get('pw');

        if (!shareId || !submittedPassword) {
            return NextResponse.json({ error: 'Missing credentials.' }, { status: 400 });
        }

        const LIBRARY_PATH = await getLibraryPath();
        if (!LIBRARY_PATH) return NextResponse.json({ error: 'Library path not set' }, { status: 500 });

        const shareDir = path.join(LIBRARY_PATH, 'shares');
        const zipPath = path.join(shareDir, `${shareId}.zip`);
        const metaPath = path.join(shareDir, `${shareId}.json`);

        if (!existsSync(metaPath)) {
            return NextResponse.json({ error: 'Link invalid or expired' }, { status: 404 });
        }

        const metadata = JSON.parse(await fs.readFile(metaPath, 'utf-8'));

        if (submittedPassword !== metadata.password) {
            return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
        }

        if (!existsSync(zipPath)) {
            return NextResponse.json({ error: 'Zip file is missing' }, { status: 404 });
        }

        const stats = await fs.stat(zipPath);

        const responseHeaders = new Headers();
        responseHeaders.set('Content-Type', 'application/zip');
        responseHeaders.set('Content-Length', stats.size.toString());
        responseHeaders.set('Content-Disposition', `attachment; filename="3dbridge_collection_${shareId}.zip"`);

        // @ts-ignore - native readable stream
        const stream = createReadStream(zipPath);

        // @ts-ignore
        return new Response(stream, {
            status: 200,
            headers: responseHeaders,
        });

    } catch (error: any) {
        console.error('Download Shared Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
