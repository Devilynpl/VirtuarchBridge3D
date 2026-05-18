import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

export async function POST(req: Request) {
    if (!JWT_SECRET) {
        console.error('JWT_SECRET is not defined');
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        try {
            jwt.verify(token, JWT_SECRET);
        } catch (err) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const { libraryPath } = await req.json();

        if (!libraryPath) {
            return NextResponse.json({ error: 'Library path is required' }, { status: 400 });
        }

        // Save to config.json in the project root
        const configPath = path.join(process.cwd(), 'config.json');
        const config = { libraryPath };

        await fs.writeFile(configPath, JSON.stringify(config, null, 2));

        return NextResponse.json({ success: true, libraryPath });
    } catch (error) {
        console.error('Error saving library path:', error);
        return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 });
    }
}
