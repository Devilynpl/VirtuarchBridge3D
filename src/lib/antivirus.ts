import { execFile } from 'child_process';
import util from 'util';
import fs from 'fs';

const execFileAsync = util.promisify(execFile);
const DEFENDER_PATH = "C:\\Program Files\\Windows Defender\\MpCmdRun.exe";

/**
 * Scans a file using Windows Defender.
 * @param filePath Absolute path to the file to scan.
 * @returns Promise that resolves if clean, rejects if infected or error.
 */
export async function scanFile(filePath: string): Promise<void> {
    // 1. Check if Defender exists
    if (!fs.existsSync(DEFENDER_PATH)) {
        console.warn(`[Antivirus] Windows Defender not found at ${DEFENDER_PATH}. Skipping scan.`);
        return; // Fail-open: allow file if AV is missing (dev env)
    }

    try {
        // 2. Run Scan securely using execFile (preventing command injection)
        // -Scan -ScanType 3 -File <path>
        // Exit code 0 = Clean
        // Exit code 2 = Infected
        await execFileAsync(DEFENDER_PATH, ['-Scan', '-ScanType', '3', '-File', filePath]);
    } catch (error: any) {
        // ExecFile throws if exit code != 0
        if (error.code === 2) {
            console.error(`[Antivirus] Threat detected in ${filePath}!`);
            throw new Error('Antivirus scan failed: Threat detected.');
        } else {
            console.error(`[Antivirus] Error scanning file: ${error.message}`);
            // Decide policy: fail-open or fail-closed?
            // For now, let's throw to be safe if scan fails for unknown reasons
            throw new Error('Antivirus scan error.');
        }
    }
}
