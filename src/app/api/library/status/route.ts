import { NextResponse } from 'next/server';
import { initWatcher, getLastLibraryUpdate } from '@/lib/watcher';

export async function GET() {
    try {
        await initWatcher();
        return NextResponse.json({
            status: 'active',
            lastUpdate: getLastLibraryUpdate()
        });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
