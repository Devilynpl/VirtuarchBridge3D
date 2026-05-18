import fs from 'fs-extra';
import path from 'path';
import * as lz4 from 'lz4js';
import { createSignatureBlock, sha256, type SignatureBlock } from './crypto-engine';

/**
 * .ASS / .ASSET Format v3.0 (Secure Signed)
 * High-performance, Encrypted/Obfuscated 3D Asset Container
 * with RSA-SHA256 Digital Signatures.
 * 
 * Header Layout (24 bytes):
 *   [0-3]   Magic: 'ASS!'
 *   [4-7]   Version: 0x03
 *   [8-11]  Header size (24)
 *   [12-15] Thumbnail size (raw, unencrypted)
 *   [16-19] Index offset
 *   [20-23] Signature block offset (0 = unsigned)
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

export interface PackOptions {
    sellerPrivateKey?: string;  // PEM private key for signing
    sellerPublicKey?: string;   // PEM public key (embedded in signature)
}

export class AssetArchiver {
    private magic = Buffer.from('ASS!');
    private version = 0x03; // v3.0 — Signed

    async pack(folderPath: string, outputPath: string, options?: PackOptions) {
        const folderName = path.basename(folderPath);
        const assetCode = path.basename(outputPath).split('_')[0];
        const securityKey = `3DBRIDGE_SECURE_KEY_${assetCode}`;

        // 1. Scan files
        const filesFlat = await this.recursiveReaddir(folderPath);

        // 2. Identify Thumbnail
        const thumbCandidates = ['thumbnail.png', 'thumbnail.jpg', 'preview.png', 'preview.jpg', 'icon.png'];
        let thumbFile = filesFlat.find(f => thumbCandidates.includes(path.basename(f).toLowerCase()));
        if (!thumbFile) thumbFile = filesFlat.find(f => ['.png', '.jpg', '.jpeg'].includes(path.extname(f).toLowerCase()));
        const thumbBuffer = thumbFile ? await fs.readFile(thumbFile) : Buffer.alloc(0);

        // 3. Header setup
        const headSize = 24;
        const fileChunks: Buffer[] = [];
        let currentOffset = headSize + thumbBuffer.length;

        const index: any[] = [];
        for (const file of filesFlat) {
            const relPath = path.relative(folderPath, file).replace(/\\/g, '/');
            const content = await fs.readFile(file);

            const compressed = Buffer.from(lz4.compress(content));
            const encrypted = FastCipher.crypt(compressed, securityKey);

            fileChunks.push(encrypted);
            index.push({
                name: relPath,
                offset: currentOffset,
                compressedSize: encrypted.length,
                uncompressedSize: content.length
            });
            currentOffset += encrypted.length;
        }

        // 4. Index
        const indexOffset = currentOffset;
        const indexData = Buffer.from(JSON.stringify(index));
        const compressedIndex = Buffer.from(lz4.compress(indexData));
        const encryptedIndex = FastCipher.crypt(compressedIndex, securityKey);
        fileChunks.push(encryptedIndex);
        currentOffset += encryptedIndex.length;

        // 5. Signature Block (optional — requires seller keypair)
        let sigOffset = 0;
        if (options?.sellerPrivateKey && options?.sellerPublicKey) {
            const sigBlock = createSignatureBlock(indexData, options.sellerPrivateKey, options.sellerPublicKey);
            const sigJson = Buffer.from(JSON.stringify(sigBlock));
            const encryptedSig = FastCipher.crypt(sigJson, securityKey);
            fileChunks.push(encryptedSig);
            sigOffset = currentOffset;
            currentOffset += encryptedSig.length;
            console.log(`[Archiver] Package signed with RSA-SHA256. Signature at offset ${sigOffset}`);
        }

        // 6. Build Header
        const header = Buffer.alloc(headSize);
        header.write('ASS!', 0);
        header.writeUInt32LE(this.version, 4);
        header.writeUInt32LE(headSize, 8);
        header.writeUInt32LE(thumbBuffer.length, 12);
        header.writeUInt32LE(indexOffset, 16);
        header.writeUInt32LE(sigOffset, 20); // 0 = unsigned, >0 = signed

        const finalBuffer = Buffer.concat([header, thumbBuffer, ...fileChunks]);
        await fs.writeFile(outputPath, finalBuffer);

        return {
            count: index.length,
            size: finalBuffer.length,
            signed: sigOffset > 0,
            version: this.version
        };
    }

    private async recursiveReaddir(dir: string): Promise<string[]> {
        const dirents = await fs.readdir(dir, { withFileTypes: true });
        const files = await Promise.all(dirents.map((dirent) => {
            const res = path.resolve(dir, dirent.name);
            return dirent.isDirectory() ? this.recursiveReaddir(res) : res;
        }));
        return Array.prototype.concat(...files);
    }
}
