import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';

export async function POST(req: NextRequest) {
    try {
        const { path: folderPath } = await req.json();
        if (!folderPath) {
            return NextResponse.json({ error: 'Path is required' }, { status: 400 });
        }

        // Normalize path for Windows Explorer
        const normalizedPath = folderPath.replace(/\//g, '\\');

        // Open folder in system file explorer
        if (process.platform === 'win32') {
            exec(`explorer "${normalizedPath}"`);
        } else if (process.platform === 'darwin') {
            exec(`open "${normalizedPath}"`);
        } else {
            exec(`xdg-open "${normalizedPath}"`);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error opening folder:', error);
        return NextResponse.json({ error: 'Failed to open folder' }, { status: 500 });
    }
}
