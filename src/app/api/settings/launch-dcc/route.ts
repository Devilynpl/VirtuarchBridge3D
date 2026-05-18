import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

/**
 * 🚀 DCC Software Launcher API
 * 
 * POST: Launch a DCC application by its exe path
 * Validates path exists and is an .exe file before launching
 */

export async function POST(req: NextRequest) {
    try {
        const { exePath } = await req.json();

        if (!exePath || typeof exePath !== 'string') {
            return NextResponse.json({ error: 'exePath is required' }, { status: 400 });
        }

        const normalized = path.normalize(exePath);

        // Security checks
        if (!normalized.toLowerCase().endsWith('.exe')) {
            return NextResponse.json({ error: 'Only .exe files can be launched' }, { status: 400 });
        }

        if (!existsSync(normalized)) {
            return NextResponse.json({ error: `File not found: ${normalized}` }, { status: 404 });
        }

        // Launch the process detached (don't wait for it)
        const child = exec(`"${normalized}"`, {
            windowsHide: false,
            cwd: path.dirname(normalized),
        });

        // Detach so the server doesn't hang
        child.unref();

        console.log(`[DCC Launcher] Launched: ${normalized}`);

        return NextResponse.json({
            success: true,
            launched: normalized,
            pid: child.pid
        });

    } catch (error: any) {
        console.error('[DCC Launcher] Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to launch' }, { status: 500 });
    }
}
