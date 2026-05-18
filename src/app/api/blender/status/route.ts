import { NextResponse } from 'next/server';

const BLENDER_SERVER_URL = 'http://127.0.0.1:28888';

export async function GET() {
    try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(BLENDER_SERVER_URL, {
            method: 'GET', // Check status
            signal: controller.signal,
            cache: 'no-store'
        }).catch(() => ({ ok: false }));

        clearTimeout(id);

        return NextResponse.json({
            connected: (response as any).status !== undefined || (response as any).ok
        });
    } catch (e: any) {
        console.error("Blender Status Check Error:", e.message);
        return NextResponse.json({ connected: false, error: e.message });
    }
}
