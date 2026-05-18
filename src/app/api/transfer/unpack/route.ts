import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { verifyAuth } from '@/lib/auth';
import { getLibraryPath } from '@/lib/config';
import { exec } from 'child_process';
import util from 'util';
import { scanFile } from '@/lib/antivirus';

const execPromise = util.promisify(exec);

export async function POST(req: NextRequest) {
    let zipDestPath: string | null = null;
    try {
        const user = await verifyAuth(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const formData = await req.formData();
        const file = formData.get('file') as File;
        const key = formData.get('key') as string | null;
        if (!file) return NextResponse.json({ error: 'No zip file provided' }, { status: 400 });

        const LIBRARY_PATH = await getLibraryPath();
        if (!LIBRARY_PATH) return NextResponse.json({ error: 'Library path not set' }, { status: 500 });

        const uploadedFileName = file.name || 'transfer.zip';
        zipDestPath = path.join(LIBRARY_PATH, uploadedFileName);

        // 1. Save uploaded zip (which naturally has filename `${id}encrypted.zip`) to Library Path
        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(zipDestPath, buffer);

        // 2. Scan with Antivirus
        try {
            await scanFile(zipDestPath);
        } catch (scanError: any) {
            console.error("Antivirus Blocked:", scanError.message);
            // Try to delete immediately if infected/error
            await fs.unlink(zipDestPath).catch(() => { });
            return NextResponse.json({ error: 'Security Check Failed: Threat detected In Uploaded File' }, { status: 400 });
        }

        // 3. Process the safe file by executing the universal `unzip` command
        const idMatch = uploadedFileName.match(/(.*)encrypted\.zip/i);
        const id = idMatch ? idMatch[1] : uploadedFileName.replace('.zip', '');

        let unpackCmd = key ?
            `unzip -P "${key}" "${id}encrypted.zip"` :
            `unzip "${id}encrypted.zip"`;

        console.log("Executing unpack command:", unpackCmd);

        try {
            await execPromise(unpackCmd, { cwd: LIBRARY_PATH });
        } catch (execError: any) {
            console.error('Exec unpack error:', execError);
            return NextResponse.json({ error: 'Failed to run unpacking command' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            extracted: true
        });
    } catch (err: any) {
        console.error('Unpack Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    } finally {
        // Cleanup zip file
        if (zipDestPath) {
            await fs.unlink(zipDestPath).catch(() => { });
        }
    }
}
