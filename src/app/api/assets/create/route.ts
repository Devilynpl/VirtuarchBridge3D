import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { verifyAuth } from '@/lib/auth';
import { getLibraryPath } from '@/lib/config';
import { scanFile } from '@/lib/antivirus';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
    if (rateLimit(request as any)) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }
    const LIB_PATH = await getLibraryPath();
    const user = await verifyAuth(request);

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!LIB_PATH) {
        return NextResponse.json({ error: 'Library path not configured' }, { status: 500 });
    }

    try {
        const formData = await request.formData();
        const name = formData.get('name') as string;
        const category = formData.get('category') as string;
        const type = formData.get('type') as string;
        const renderedThumbnailB64 = formData.get('renderedThumbnail') as string | null;

        if (!name || !category || !type) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const assetCode = Math.floor(Math.random() * 900000000000 + 100000000000).toString();
        const safeCategory = category.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
        const safeAssetName = name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');

        const targetDir = path.resolve(LIB_PATH, 'Custom', type, safeCategory, assetCode);
        const resolvedLibPath = path.resolve(LIB_PATH);
        if (!targetDir.startsWith(resolvedLibPath)) {
            return NextResponse.json({ error: 'Invalid target path' }, { status: 400 });
        }
        await fs.mkdir(targetDir, { recursive: true });

        const dataDir = path.join(LIB_PATH, 'Data');
        await fs.mkdir(dataDir, { recursive: true });

        const files = formData.getAll('files') as File[];
        const components: any[] = [];
        const maps: any[] = [];
        let thumbnail: string | null = null;

        const MAX_FILE_SIZE = 100 * 1024 * 1024;
        const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.exr', '.tga', '.fbx', '.obj', '.abc'];

        for (const file of files) {
            const fileName = path.basename(file.name);
            const ext = path.extname(fileName).toLowerCase();
            const buffer = Buffer.from(await file.arrayBuffer());
            const filePath = path.resolve(targetDir, fileName);
            await fs.writeFile(filePath, buffer);

            const fileLower = fileName.toLowerCase();
            const isImage = fileLower.endsWith('.jpg') || fileLower.endsWith('.png') || fileLower.endsWith('.exr') || fileLower.endsWith('.tga');

            let mapType = 'other';
            if (fileLower.includes('albedo') || fileLower.includes('diffuse') || fileLower.includes('color')) {
                mapType = 'albedo';
                if (!thumbnail) thumbnail = fileName;
            }
            else if (fileLower.includes('normal')) mapType = 'normal';
            else if (fileLower.includes('roughness')) mapType = 'roughness';
            else if (fileLower.includes('displacement') || fileLower.includes('height')) mapType = 'displacement';
            else if (fileLower.includes('opacity') || fileLower.includes('alpha')) mapType = 'opacity';
            else if (fileLower.includes('metal')) mapType = 'metalness';
            else if (fileLower.includes('ao')) mapType = 'ao';

            if (isImage) {
                if (!thumbnail) thumbnail = fileName;
                maps.push({ type: mapType, uri: fileName });
                components.push({ type: mapType, name: mapType, uris: [fileName] });
            }
        }

        // Save rendered thumbnail from WebGL canvas 
        const assetPathArray = ['Custom', type, safeCategory, assetCode];

        if (renderedThumbnailB64) {
            try {
                const base64Data = renderedThumbnailB64.replace(/^data:image\/\w+;base64,/, '');
                const thumbBuffer = Buffer.from(base64Data, 'base64');
                await fs.writeFile(path.join(targetDir, 'thumbnail.png'), thumbBuffer);
                await fs.writeFile(path.join(dataDir, `${assetCode}.png`), thumbBuffer);
                thumbnail = 'thumbnail.png';
            } catch (e) {
                console.error('Failed to save rendered thumbnail:', e);
            }
        }

        const metadata = {
            id: assetCode,
            name: name,
            type: type,
            categories: [category],
            tags: ['custom'],
            maps: maps,
            components: components,
            path: assetPathArray,
            thumb: thumbnail ? [...assetPathArray, thumbnail] : null
        };

        const jsonPath = path.join(targetDir, `${assetCode}.json`);
        await fs.writeFile(jsonPath, JSON.stringify(metadata, null, 2));

        // CRITICAL: Pack into .ASS v2.0
        const { AssetArchiver } = await import('@/lib/archiver');
        const archiver = new AssetArchiver();
        const assOutputPath = path.join(LIB_PATH, '.ass', 'Library', type, `${assetCode}_${safeAssetName}.ass`);

        // Ensure category dir in .ass library exists
        const assCategoryDir = path.dirname(assOutputPath);
        await fs.mkdir(assCategoryDir, { recursive: true });

        await archiver.pack(targetDir, assOutputPath);

        // Update assetsData.json in Data/
        const assetsDataPath = path.join(dataDir, 'assetsData.json');
        let assetsData: any[] = [];
        if (existsSync(assetsDataPath)) {
            const raw = await fs.readFile(assetsDataPath, 'utf-8');
            assetsData = JSON.parse(raw);
        }

        assetsData.push(metadata);
        await fs.writeFile(assetsDataPath, JSON.stringify(assetsData, null, 2));

        return NextResponse.json({ success: true, assetId: assetCode, assFile: assOutputPath });
    } catch (error: any) {
        console.error('Create Asset Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
