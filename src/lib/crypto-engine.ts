import crypto from 'crypto';
import os from 'os';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  3DBRIDGE Crypto Engine v1.0                                ║
 * ║  RSA Digital Signing + Hardware-Locked Key Derivation        ║
 * ╚══════════════════════════════════════════════════════════════╝
 * 
 * This module provides:
 * 1. RSA-2048 keypair generation for sellers
 * 2. Digital signing of .ASS package indices (tamper protection)
 * 3. Signature verification on unpack
 * 4. Hardware fingerprint generation (machine-locked keys)
 * 5. HMAC-based key derivation for per-user, per-machine security
 */

// ═══════════════════════════════════════
//  RSA Key Management
// ═══════════════════════════════════════

export interface KeyPair {
    publicKey: string;   // PEM-encoded public key
    privateKey: string;  // PEM-encoded private key
}

/**
 * Generate a new RSA-2048 keypair for a seller.
 * The public key is stored in the DB and shared with buyers.
 * The private key is stored ONLY on the seller's machine.
 */
export function generateKeyPair(): KeyPair {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });

    return { publicKey, privateKey };
}

// ═══════════════════════════════════════
//  Digital Signatures (RSA-SHA256)
// ═══════════════════════════════════════

/**
 * Sign data with the seller's private key.
 * Used to sign the package index hash during .ASS creation.
 * 
 * @param data The data to sign (typically SHA-256 hash of the index)
 * @param privateKeyPem PEM-encoded RSA private key
 * @returns Base64-encoded signature
 */
export function signData(data: Buffer, privateKeyPem: string): string {
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(data);
    signer.end();
    return signer.sign(privateKeyPem, 'base64');
}

/**
 * Verify a signature against the seller's public key.
 * Used on unpack to ensure the package hasn't been tampered with.
 * 
 * @param data The original data that was signed
 * @param signature Base64-encoded signature
 * @param publicKeyPem PEM-encoded RSA public key
 * @returns true if signature is valid
 */
export function verifySignature(data: Buffer, signature: string, publicKeyPem: string): boolean {
    try {
        const verifier = crypto.createVerify('RSA-SHA256');
        verifier.update(data);
        verifier.end();
        return verifier.verify(publicKeyPem, signature, 'base64');
    } catch (e) {
        console.error('[CryptoEngine] Signature verification failed:', e);
        return false;
    }
}

/**
 * Compute SHA-256 hash of the given data.
 * Used to create a compact digest of the package index before signing.
 */
export function sha256(data: Buffer | string): Buffer {
    return crypto.createHash('sha256').update(data).digest();
}

// ═══════════════════════════════════════
//  Hardware Fingerprinting
// ═══════════════════════════════════════

export interface HardwareFingerprint {
    machineId: string;      // Unique machine identifier hash
    platform: string;       // e.g. 'win32', 'darwin', 'linux'
    arch: string;           // e.g. 'x64', 'arm64'
    hostname: string;       // Machine hostname
    cpuModel: string;       // Primary CPU model
    totalMemory: string;    // Total RAM in GB
    rawComponents: string;  // Concatenated hardware string (before hashing)
}

/**
 * Generate a hardware fingerprint for the current machine.
 * This is used to bind decryption keys to specific hardware.
 * 
 * The fingerprint is a SHA-256 hash of:
 *   hostname + cpuModel + totalMemoryGB + platform + arch + networkMACs
 * 
 * This is NOT crackable from the hash alone, and changes if the user
 * significantly modifies their hardware (new CPU, new motherboard).
 */
export function getHardwareFingerprint(): HardwareFingerprint {
    const hostname = os.hostname();
    const platform = os.platform();
    const arch = os.arch();
    const cpus = os.cpus();
    const cpuModel = cpus[0]?.model || 'unknown-cpu';
    const totalMemory = `${Math.round(os.totalmem() / (1024 * 1024 * 1024))}GB`;

    // Get unique network interface MACs (sorted for consistency)
    const networkInterfaces = os.networkInterfaces();
    const macs: string[] = [];
    for (const iface of Object.values(networkInterfaces)) {
        if (iface) {
            for (const info of iface) {
                if (info.mac && info.mac !== '00:00:00:00:00:00' && !info.internal) {
                    macs.push(info.mac);
                }
            }
        }
    }
    const sortedMacs = [...new Set(macs)].sort().join('|');

    // Build raw component string
    const rawComponents = [
        `HOST:${hostname}`,
        `CPU:${cpuModel}`,
        `MEM:${totalMemory}`,
        `PLATFORM:${platform}`,
        `ARCH:${arch}`,
        `MACS:${sortedMacs}`
    ].join('::');

    // Hash it
    const machineId = crypto
        .createHash('sha256')
        .update(rawComponents)
        .update('3DBRIDGE_HARDWARE_SALT_v1') // Salt to prevent rainbow tables
        .digest('hex');

    return {
        machineId,
        platform,
        arch,
        hostname,
        cpuModel,
        totalMemory,
        rawComponents
    };
}

/**
 * Get a short, displayable machine ID (first 16 chars of full hash).
 * Used in UI and API responses.
 */
export function getShortMachineId(): string {
    return getHardwareFingerprint().machineId.substring(0, 16).toUpperCase();
}

// ═══════════════════════════════════════
//  Key Derivation (HMAC-based)
// ═══════════════════════════════════════

/**
 * Derive a unique decryption key using HMAC-SHA256.
 * The key is bound to: assetCode + userId + machineId
 * 
 * This means:
 * - A different user gets a different key (even for the same asset)
 * - The same user on a different machine gets a different key
 * - Only the exact combination of (asset, user, machine) produces the correct key
 * 
 * @param assetCode The 12-digit asset code
 * @param userId User's UUID
 * @param machineId Machine fingerprint hash
 * @returns 64-character hex key
 */
export function deriveSecureKey(assetCode: string, userId: string, machineId: string): string {
    const hmac = crypto.createHmac('sha256', '3DBRIDGE_MASTER_KDF_v2');
    hmac.update(`${assetCode}:${userId}:${machineId}`);
    return hmac.digest('hex');
}

/**
 * Derive a session-bound temporary key.
 * Valid only for a specific time window (default: 1 hour).
 * 
 * @param baseKey The derived secure key
 * @param sessionId Unique session identifier
 * @param ttlHours Time-to-live in hours (for the time bucket)
 * @returns Hex-encoded session key
 */
export function deriveSessionKey(baseKey: string, sessionId: string, ttlHours: number = 1): string {
    // Create a time bucket (floor to nearest ttlHours)
    const timeBucket = Math.floor(Date.now() / (ttlHours * 3600 * 1000));

    const hmac = crypto.createHmac('sha256', baseKey);
    hmac.update(`SESSION:${sessionId}:BUCKET:${timeBucket}`);
    return hmac.digest('hex');
}

// ═══════════════════════════════════════
//  Package Signature Block
// ═══════════════════════════════════════

/**
 * Structure of the signature block appended to .ASS v3.0 files.
 * This replaces the reserved bytes [20-23] in the header with
 * a pointer to the signature block.
 */
export interface SignatureBlock {
    version: number;            // Signature scheme version (1)
    algorithm: string;          // 'RSA-SHA256'
    sellerPublicKey: string;    // PEM public key of the seller
    indexHash: string;          // SHA-256 hash of the decrypted index
    signature: string;          // RSA signature of the index hash
    timestamp: number;          // Unix timestamp of signing
    machineId?: string;         // Optional: seller's machine ID at time of signing
}

/**
 * Create a complete signature block for a package.
 * 
 * @param indexData The raw (unencrypted) index JSON buffer
 * @param sellerPrivateKey PEM-encoded seller private key
 * @param sellerPublicKey PEM-encoded seller public key
 * @returns SignatureBlock ready for serialization
 */
export function createSignatureBlock(
    indexData: Buffer,
    sellerPrivateKey: string,
    sellerPublicKey: string
): SignatureBlock {
    const indexHash = sha256(indexData).toString('hex');
    const hashBuffer = Buffer.from(indexHash, 'utf-8');
    const signature = signData(hashBuffer, sellerPrivateKey);

    return {
        version: 1,
        algorithm: 'RSA-SHA256',
        sellerPublicKey,
        indexHash,
        signature,
        timestamp: Date.now(),
        machineId: getShortMachineId()
    };
}

/**
 * Verify a signature block against the actual index data.
 * 
 * @param signatureBlock The signature block from the package
 * @param indexData The decrypted index JSON buffer
 * @returns Object with validity status and details
 */
export function verifySignatureBlock(
    signatureBlock: SignatureBlock,
    indexData: Buffer
): { valid: boolean; reason: string; details: Record<string, any> } {
    // 1. Verify index hash matches
    const actualHash = sha256(indexData).toString('hex');
    if (actualHash !== signatureBlock.indexHash) {
        return {
            valid: false,
            reason: 'INDEX_TAMPERED',
            details: {
                expected: signatureBlock.indexHash,
                actual: actualHash,
                message: 'The package index has been modified since signing. This asset may be compromised.'
            }
        };
    }

    // 2. Verify RSA signature
    const hashBuffer = Buffer.from(signatureBlock.indexHash, 'utf-8');
    const isValidSig = verifySignature(hashBuffer, signatureBlock.signature, signatureBlock.sellerPublicKey);

    if (!isValidSig) {
        return {
            valid: false,
            reason: 'SIGNATURE_INVALID',
            details: {
                algorithm: signatureBlock.algorithm,
                timestamp: new Date(signatureBlock.timestamp).toISOString(),
                message: 'The digital signature is invalid. This package was not signed by the claimed seller.'
            }
        };
    }

    return {
        valid: true,
        reason: 'VERIFIED',
        details: {
            algorithm: signatureBlock.algorithm,
            signedAt: new Date(signatureBlock.timestamp).toISOString(),
            sellerMachine: signatureBlock.machineId || 'unknown',
            message: 'Package integrity verified. This asset is authentic.'
        }
    };
}
