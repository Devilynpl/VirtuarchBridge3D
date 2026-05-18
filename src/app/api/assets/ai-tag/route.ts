import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getLibraryPath } from '@/lib/config';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
    try {
        const user = await verifyAuth(req);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const LIBRARY_PATH = await getLibraryPath();
        if (!LIBRARY_PATH) {
            return NextResponse.json({ error: 'Library path not configured' }, { status: 500 });
        }

        const { assetId, assetJsonPath, thumbnailPath } = await req.json();

        if (!assetJsonPath || !thumbnailPath || !existsSync(assetJsonPath) || !existsSync(thumbnailPath)) {
            return NextResponse.json({ error: 'Missing metadata or thumbnail file.' }, { status: 400 });
        }

        // Validate Paths
        const resolvedJsonPath = path.resolve(assetJsonPath);
        const resolvedThumbPath = path.resolve(thumbnailPath);
        const resolvedLibraryPath = path.resolve(LIBRARY_PATH);

        if (!resolvedJsonPath.startsWith(resolvedLibraryPath) || !resolvedThumbPath.startsWith(resolvedLibraryPath)) {
            return NextResponse.json({ error: 'Unauthorized path access.' }, { status: 403 });
        }

        // Read thumbnail as Base64
        const thumbBuffer = await fs.readFile(resolvedThumbPath);
        const base64Image = thumbBuffer.toString('base64');

        // Note: ollama running locally on default port 11434. Uses moondream model for vision.
        // Needs "ollama run moondream" installed.
        const OLLAMA_URL = 'http://localhost:11434/api/generate';
        const prompt = "Describe this object in up to 5 simple, comma-separated keywords (e.g., 'wood, planks, worn, brown, industrial'). Focus only on visual characteristics, material, and shape. Do NOT use sentences or narrative text.";

        const ollamaResponse = await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'moondream',
                prompt: prompt,
                images: [base64Image],
                stream: false
            })
        });

        if (!ollamaResponse.ok) {
            return NextResponse.json({ error: 'Failed to communicate with Local Ollama. Is it running?' }, { status: 502 });
        }

        const ollamaData = await ollamaResponse.json();
        const keywordsResponseText = ollamaData.response || "";

        // Parse keywords
        const newTags = keywordsResponseText.split(',').map((t: string) => t.trim().toLowerCase()).filter((t: string) => t.length > 0);

        // Save tags back to the JSON file
        const rawJson = await fs.readFile(resolvedJsonPath, 'utf-8');
        const metadata = JSON.parse(rawJson);

        const currentTags = Array.isArray(metadata.tags) ? metadata.tags : [];
        const mergedTags = Array.from(new Set([...currentTags, ...newTags]));

        metadata.tags = mergedTags;

        await fs.writeFile(resolvedJsonPath, JSON.stringify(metadata, null, 2), 'utf-8');

        return NextResponse.json({ success: true, tags: mergedTags });
    } catch (e: any) {
        console.error('AI Tagging Error:', e);
        return NextResponse.json({ error: 'Failed to auto-tag asset: ' + e.message }, { status: 500 });
    }
}
