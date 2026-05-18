export interface ScanResult {
    safe: boolean;
    threats: string[];
    scannedFiles: number;
}

const FORBIDDEN_EXTENSIONS = [
    '.exe', '.msi', '.bat', '.cmd', '.sh', '.vbs', '.js', '.vbe', '.jse', '.wsf', '.wsh', '.msc', '.scr'
];

/**
 * Scans a file name and metadata for potential threats.
 * In a real-world scenario, this would check file signatures/hashes.
 */
export async function scanFile(filename: string, content?: Buffer): Promise<{ safe: boolean; reason?: string }> {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));

    if (FORBIDDEN_EXTENSIONS.includes(ext)) {
        return { safe: false, reason: `Forbidden extension: ${ext}` };
    }

    // Basic check for script content if it's a suspicious but allowed type
    if (content && (ext === '.json' || ext === '.xml')) {
        const text = content.toString();
        if (text.includes('<script') || text.includes('eval(') || text.includes('exec(')) {
            return { safe: false, reason: 'Suspicious script content detected' };
        }
    }

    return { safe: true };
}

/**
 * Scans a folder (represented as a list of entries).
 */
export async function scanFolder(files: { name: string; content?: Buffer }[]): Promise<ScanResult> {
    const threats: string[] = [];
    let scannedCount = 0;

    for (const file of files) {
        scannedCount++;
        const result = await scanFile(file.name, file.content);
        if (!result.safe) {
            threats.push(`${file.name}: ${result.reason}`);
        }
    }

    return {
        safe: threats.length === 0,
        threats,
        scannedFiles: scannedCount
    };
}
