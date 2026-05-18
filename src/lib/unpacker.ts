import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import * as lz4 from 'lz4js';
import { verifySignatureBlock, type SignatureBlock } from './crypto-engine';
import { getSafePath } from './fs-safety';

/**
 * Universal .ASS / .ASSET v2.0 Unpacker
 * 
 * Securely decrypts and decompresses an encrypted asset package
 * into a temporary folder for consumption by DCC plugins (Blender, Unreal).
 * 
 * Architecture:
 *   [24B Header] → [Raw Thumb] → [Encrypted Data Blocks] → [Encrypted Index]
 * 
 * The unpacker reads the encrypted index to discover all files,
 * then decrypts + decompresses each block into a secure temp directory.
 * The temp directory is automatically cleaned up after use.
 */

class FastCipher {
    static crypt(data: Buffer, keyStr: string): Buffer {
        const key = Buffer.from(keyStr);
        const kl = key.length;
        const result = Buffer.alloc(data.length);
        for (let i = 0; i < data.length; i++) {
            result[i] = data[i] ^ (key[i % kl] + (i % 256));
        }
        return result;
    }
}

export interface UnpackResult {
    tempDir: string;
    files: string[];
    assetCode: string;
    totalSize: number;
    cleanup: () => Promise<void>;
    signatureValid?: boolean;       // true = verified, false = tampered, undefined = unsigned
    signatureDetails?: string;      // Human-readable verification message
}

export interface UnpackIndex {
    name: string;
    offset: number;
    compressedSize: number;
    uncompressedSize: number;
}

/**
 * Unpack an .ASS/.ASSET file to a secure temporary directory
 */
export async function unpackAsset(assetFilePath: string, securityKeyOverride?: string): Promise<UnpackResult> {
    const basename = path.basename(assetFilePath);
    const assetCode = basename.split('_')[0] || basename.replace(/\.(ass|asset)$/i, '');
    const securityKey = securityKeyOverride || `3DBRIDGE_SECURE_KEY_${assetCode}`;

    // Create secure temp directory
    const tempDir = path.join(os.tmpdir(), `3dbridge_unpack_${assetCode}_${Date.now()}`);
    await fs.ensureDir(tempDir);

    try {
        const fileBuffer = await fs.readFile(assetFilePath);

        // 1. Read Header (24 bytes)
        const magic = fileBuffer.toString('ascii', 0, 4);
        if (magic !== 'ASS!') {
            throw new Error(`Invalid .ass file: bad magic number '${magic}' (expected 'ASS!')`);
        }

        const version = fileBuffer.readUInt32LE(4);
        const headSize = fileBuffer.readUInt32LE(8);
        const thumbSize = fileBuffer.readUInt32LE(12);
        const indexOffset = fileBuffer.readUInt32LE(16);

        console.log(`[Unpacker] v${version} | Header: ${headSize}B | Thumb: ${thumbSize}B | Index @${indexOffset}`);

        // 2. Read and decrypt the Index
        const encryptedIndex = fileBuffer.subarray(indexOffset);
        const decryptedIndex = FastCipher.crypt(Buffer.from(encryptedIndex), securityKey);

        // Decompress the index
        const decompressedIndex = Buffer.from(lz4.decompress(decryptedIndex));
        const index: UnpackIndex[] = JSON.parse(decompressedIndex.toString('utf-8'));

        console.log(`[Unpacker] Index contains ${index.length} file entries.`);

        // 2b. Verify Signature (if present — v3.0+)
        const sigOffset = fileBuffer.readUInt32LE(20);
        let signatureValid: boolean | undefined = undefined;
        let signatureDetails = 'Package is unsigned (v2.0 format)';

        if (sigOffset > 0 && sigOffset < fileBuffer.length) {
            try {
                // The sig block sits between the encrypted index and EOF
                // We need to figure out its boundaries
                const encryptedSigData = fileBuffer.subarray(sigOffset);
                const decryptedSigData = FastCipher.crypt(Buffer.from(encryptedSigData), securityKey);
                const sigBlock: SignatureBlock = JSON.parse(decryptedSigData.toString('utf-8'));

                const verification = verifySignatureBlock(sigBlock, decompressedIndex);
                signatureValid = verification.valid;
                signatureDetails = verification.details.message;
                console.log(`[Unpacker] Signature: ${verification.valid ? '✅ VERIFIED' : '❌ ' + verification.reason}`);
            } catch (e) {
                signatureValid = false;
                signatureDetails = 'Signature block is corrupted or unreadable';
                console.warn('[Unpacker] Failed to parse signature block:', e);
            }
        }

        // 3. Extract each file
        const files: string[] = [];
        let totalSize = 0;

        for (const entry of index) {
            // Read encrypted+compressed block
            const encryptedBlock = fileBuffer.subarray(entry.offset, entry.offset + entry.compressedSize);

            // Decrypt
            const decryptedBlock = FastCipher.crypt(Buffer.from(encryptedBlock), securityKey);

            // Decompress
            const decompressedBlock = Buffer.from(lz4.decompress(decryptedBlock));

            // Write to temp directory securely (preventing Zip Slip path traversal)
            const outputPath = getSafePath(tempDir, entry.name);
            await fs.ensureDir(path.dirname(outputPath));
            await fs.writeFile(outputPath, decompressedBlock);

            files.push(entry.name);
            totalSize += decompressedBlock.length;
        }

        // 4. Also extract the raw thumbnail if present
        if (thumbSize > 0) {
            const thumbData = fileBuffer.subarray(headSize, headSize + thumbSize);
            let thumbExt = '.jpg';
            if (thumbData[0] === 0x89 && thumbData[1] === 0x50) thumbExt = '.png';
            else if (thumbData[0] === 0x52 && thumbData[1] === 0x49) thumbExt = '.webp';

            const thumbPath = path.join(tempDir, `thumbnail${thumbExt}`);
            await fs.writeFile(thumbPath, thumbData);
            files.push(`thumbnail${thumbExt}`);
            totalSize += thumbSize;
        }

        console.log(`[Unpacker] Successfully extracted ${files.length} files (${(totalSize / 1024 / 1024).toFixed(1)}MB) to ${tempDir}`);

        return {
            tempDir,
            files,
            assetCode,
            totalSize,
            signatureValid,
            signatureDetails,
            cleanup: async () => {
                try {
                    await fs.remove(tempDir);
                    console.log(`[Unpacker] Cleaned up temp dir: ${tempDir}`);
                } catch (e) {
                    console.warn(`[Unpacker] Failed to cleanup: ${tempDir}`, e);
                }
            }
        };
    } catch (error) {
        // Cleanup on failure
        try { await fs.remove(tempDir); } catch (e) { }
        throw error;
    }
}

/**
 * Read just the header info from an .ASS file without unpacking
 */
export async function readAssetHeader(assetFilePath: string): Promise<{
    version: number;
    thumbSize: number;
    indexOffset: number;
    fileCount: number;
    totalCompressedSize: number;
}> {
    const { open, stat } = await import('fs/promises');
    const fd = await open(assetFilePath, 'r');
    try {
        const headerBuf = Buffer.alloc(24);
        await fd.read(headerBuf, 0, 24, 0);

        const magic = headerBuf.toString('ascii', 0, 4);
        if (magic !== 'ASS!') {
            throw new Error('Invalid .ass file');
        }

        const fileStat = await stat(assetFilePath);

        return {
            version: headerBuf.readUInt32LE(4),
            thumbSize: headerBuf.readUInt32LE(12),
            indexOffset: headerBuf.readUInt32LE(16),
            fileCount: 0, // Would need to decrypt index to know
            totalCompressedSize: fileStat.size
        };
    } finally {
        await fd.close();
    }
}
