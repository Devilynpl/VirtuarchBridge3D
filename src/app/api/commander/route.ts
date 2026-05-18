import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';

export async function GET(req: Request) {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const dirPath = searchParams.get('path') || process.cwd();

    try {
        // Security check: Prevent traversing outside of allowed scope if needed
        // For now, allow browsing full system as "Commander" implies power user tool
        
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        const files = entries.map(entry => ({
            name: entry.name,
            isDirectory: entry.isDirectory(),
            size: 0, // Would need fs.stat for size, skipping for performance on large dirs for now
            path: path.join(dirPath, entry.name),
            updatedAt: new Date().toISOString() // Placeholder
        }));

        // Get stats for details (optional, maybe limiting to top 100 or lazy load)
        const detailedFiles = await Promise.all(files.map(async (f) => {
            try {
                const stat = await fs.stat(f.path);
                return {
                    ...f,
                    size: stat.size,
                    updatedAt: stat.mtime.toISOString()
                };
            } catch {
                return f;
            }
        }));

        // Sort: Directories first, then files
        detailedFiles.sort((a, b) => {
            if (a.isDirectory === b.isDirectory) {
                return a.name.localeCompare(b.name);
            }
            return a.isDirectory ? -1 : 1;
        });

        return NextResponse.json({
            path: dirPath,
            files: detailedFiles
        });

    } catch (error) {
        return NextResponse.json({ error: 'Failed to read directory' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { action, source, destination } = await req.json();

        if (action === 'copy') {
            await fs.cp(source, destination, { recursive: true });
        } else if (action === 'move') {
            await fs.rename(source, destination);
        } else if (action === 'delete') {
            await fs.rm(source, { recursive: true, force: true });
        } else if (action === 'mkdir') {
            await fs.mkdir(source, { recursive: true });
        } else {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Commander Action Error:', error);
        return NextResponse.json({ error: 'Action failed' }, { status: 500 });
    }
}
