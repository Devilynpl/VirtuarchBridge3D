import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req: Request) {
    try {
        const { assetPath, base64 } = await req.json();

        if (!assetPath || !base64) {
            return NextResponse.json({ error: 'Missing assetPath or base64' }, { status: 400 });
        }

        // assetPath is the absolute path to the asset folder or metadata.json
        const folder = assetPath.endsWith('.json') ? path.dirname(assetPath) : assetPath;
        const thumbPath = path.join(folder, 'thumb.png');

        // Extract base64 data
        const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
        const dataBuffer = Buffer.from(base64Data, 'base64');

        await fs.writeFile(thumbPath, dataBuffer);

        // Update the metadata.json if it exists
        const metadataPath = path.join(folder, 'metadata.json');
        try {
            const raw = await fs.readFile(metadataPath, 'utf8');
            const meta = JSON.parse(raw);
            meta.thumb = 'thumb.png'; // Make it relative
            await fs.writeFile(metadataPath, JSON.stringify(meta, null, 2));
        } catch (e) {
            console.warn(`Could not update metadata.json at ${metadataPath}`, e);
        }

        return NextResponse.json({ success: true, thumbPath });
    } catch (error) {
        console.error('Failed to save thumbnail:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
