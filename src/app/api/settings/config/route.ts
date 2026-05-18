import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { saveConfig, getConfig } from '@/lib/config';

const JWT_SECRET = process.env.JWT_SECRET;

export async function GET(req: Request) {
    if (!JWT_SECRET) return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const token = authHeader.split(' ')[1];
        jwt.verify(token, JWT_SECRET);

        const config = await getConfig();
        return NextResponse.json({ config });
    } catch (e) {
        return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    if (!JWT_SECRET) return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const token = authHeader.split(' ')[1];
        jwt.verify(token, JWT_SECRET);

        const updates = await req.json();
        const newConfig = await saveConfig(updates);
        return NextResponse.json({ success: true, config: newConfig });
    } catch (error) {
        console.error('Error saving config:', error);
        return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 });
    }
}
