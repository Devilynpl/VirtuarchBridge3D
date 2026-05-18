import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import { existsSync, createReadStream } from 'fs';
import path from 'path';
import { verifyAuth } from '@/lib/auth';
import { getLibraryPath } from '@/lib/config';

export async function GET(req: NextRequest) {
    // No auth check needed - img tags can't send JWT headers
    // Path traversal protection below ensures safety

    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get('path');

    if (!filePath) {
        return new NextResponse('Missing file path', { status: 400 });
    }

    try {
        const libraryPath = await getLibraryPath();
        if (!libraryPath) {
            return new NextResponse('Library path not configured', { status: 500 });
        }

        // Resolve absolute paths properly to prevent '..' traversal
        const absoluteLibraryPath = path.resolve(libraryPath);
        // The input path from client might be absolute or relative, resolve it strictly
        const resolvedFilePath = path.resolve(filePath);

        // Check if the resolved path starts with the resolved library path
        const normalizedResolved = resolvedFilePath.replace(/\\/g, '/').toLowerCase();
        const normalizedLib = absoluteLibraryPath.replace(/\\/g, '/').toLowerCase();

        if (!normalizedResolved.startsWith(normalizedLib)) {
            console.warn(`Blocked path traversal attempt: ${filePath} -> ${resolvedFilePath}`);
            return new NextResponse('Unauthorized path', { status: 403 });
        }

        // ══════════════════════════════════════════════════════════
        //  .ASS / .ASSET v2.0 — Header-Only Thumbnail Extraction
        //  Reads 24-byte header to locate raw embedded thumbnail.
        //  Zero decryption needed — icon block is always plaintext.
        // ══════════════════════════════════════════════════════════
        const ext = path.extname(resolvedFilePath).toLowerCase();
        if (ext === '.ass' || ext === '.asset') {
            const fd = await fs.open(resolvedFilePath, 'r');
            try {
                // Read 24-byte header
                const headerBuf = Buffer.alloc(24);
                await fd.read(headerBuf, 0, 24, 0);

                // Validate magic number
                const magic = headerBuf.toString('ascii', 0, 4);
                if (magic !== 'ASS!') {
                    return new NextResponse('Invalid .ass file (bad magic)', { status: 400 });
                }

                const headSize = headerBuf.readUInt32LE(8);   // Usually 24
                const thumbSize = headerBuf.readUInt32LE(12);  // Raw image size

                if (thumbSize === 0) {
                    return new NextResponse('No embedded thumbnail', { status: 404 });
                }

                // Read the raw thumbnail block (immediately after header)
                const thumbBuf = Buffer.alloc(thumbSize);
                await fd.read(thumbBuf, 0, thumbSize, headSize);

                // Detect image type from first bytes (PNG signature vs JPEG SOI)
                let contentType = 'image/jpeg';
                if (thumbBuf[0] === 0x89 && thumbBuf[1] === 0x50) {
                    contentType = 'image/png';
                } else if (thumbBuf[0] === 0x52 && thumbBuf[1] === 0x49) {
                    contentType = 'image/webp';
                }

                return new NextResponse(thumbBuf, {
                    headers: {
                        'Content-Type': contentType,
                        'Content-Length': thumbSize.toString(),
                        'Cache-Control': 'public, max-age=31536000, immutable',
                        'X-Source': 'ass-header-v2'
                    }
                });
            } finally {
                await fd.close();
            }
        }

        // ══════════════════════════════════════════════════════════
        //  Standard image file pass-through
        // ══════════════════════════════════════════════════════════
        const fileBuffer = await fs.readFile(resolvedFilePath);
        const contentType = getContentType(resolvedFilePath);

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000, immutable',
            }
        });
    } catch (error: any) {
        console.error('Error serving file:', error);
        if (error.code === 'ENOENT') {
            return new NextResponse('File not found', { status: 404 });
        }
        return new NextResponse('Internal server error', { status: 500 });
    }
}

function getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.png': return 'image/png';
        case '.jpg':
        case '.jpeg': return 'image/jpeg';
        case '.gif': return 'image/gif';
        case '.webp': return 'image/webp';
        case '.svg': return 'image/svg+xml';
        case '.glb': return 'model/gltf-binary';
        case '.gltf': return 'model/gltf+json';
        default: return 'application/octet-stream';
    }
}
