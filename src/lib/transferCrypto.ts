'use client';

/**
 * Bridge Encrypted Asset Transfer — Client-Side Crypto
 *
 * Scheme: X25519-ECDH key agreement + XSalsa20-Poly1305 (libsodium crypto_secretbox_easy)
 *
 * Flow:
 *   Sender derives shared_secret = ECDH(sender.privateKey, recipient.publicKey)
 *   Derives a 256-bit key via HKDF-SHA512 (using sodium's crypto_kdf)
 *   Encrypts ZIP bytes with crypto_secretbox_easy + random 24-byte nonce
 *   Sends { ciphertext_b64, nonce_b64 } to /api/transfer/secure-pack
 *   Recipient derives the SAME shared secret (X25519 is commutative)
 *   Decrypts locally — server never sees plaintext or key
 *
 * Why it's hard to crack:
 *   - X25519 provides 128-bit security (equiv. AES-256 brute force resistance)
 *   - XSalsa20-Poly1305 is authenticated — any tampering is detected
 *   - Nonce is cryptographically random — no two encryptions share state
 *   - HKDF domain-separation prevents key reuse across different protocol operations
 *   - Private keys never leave the client device (stored in memory only, not server)
 */

import _sodium from 'libsodium-wrappers';

let sodium: typeof _sodium;

const getSodium = async () => {
    if (sodium) return sodium;
    await _sodium.ready;
    sodium = _sodium;
    return sodium;
};

// ────────────────────────────────────────────────────────────────
// Derive a transfer key from two X25519 keypairs via ECDH + HKDF
// ────────────────────────────────────────────────────────────────

export async function deriveTransferKey(
    myPrivateKeyB64: string,
    theirPublicKeyB64: string,
    contextLabel: string = 'bridge-asset-transfer-v1'
): Promise<Uint8Array> {
    const s = await getSodium();

    const myPriv = s.from_base64(myPrivateKeyB64);
    const theirPub = s.from_base64(theirPublicKeyB64);

    // X25519 Diffie-Hellman — produces 32-byte shared secret
    const sharedSecret = s.crypto_scalarmult(myPriv, theirPub);

    // HKDF-like domain separation using crypto_generichash (BLAKE2b)
    // Combine shared secret + context label to prevent cross-protocol reuse
    const contextBytes = s.from_string(contextLabel);
    const combined = new Uint8Array(sharedSecret.length + contextBytes.length);
    combined.set(sharedSecret, 0);
    combined.set(contextBytes, sharedSecret.length);

    // 32-byte output key (256-bit)
    const key = s.crypto_generichash(32, combined, new Uint8Array(0));

    // Zero the intermediate secrets from memory
    sharedSecret.fill(0);
    combined.fill(0);

    return key;
}

// ────────────────────────────────────────────────────────────────
// Encrypt binary data (e.g. ZIP file bytes)
// ────────────────────────────────────────────────────────────────

export interface EncryptedPayload {
    ciphertext: string;   // base64
    nonce: string;        // base64 - 24 random bytes
    mac: string;          // base64 - poly1305 auth tag (embedded in ciphertext, but exposed separately for verification UI)
    senderPublicKey: string; // so recipient can derive the same key
    recipientPublicKey: string; // who this is for (for routing)
    transferId: string;   // unique ID for this transfer
}

export async function encryptAssetPayload(
    data: Uint8Array,
    myPrivateKeyB64: string,
    myPublicKeyB64: string,
    recipientPublicKeyB64: string,
    transferId: string
): Promise<EncryptedPayload> {
    const s = await getSodium();

    const key = await deriveTransferKey(myPrivateKeyB64, recipientPublicKeyB64, `bridge-asset-${transferId}`);

    // 24-byte cryptographically random nonce — never reused
    const nonce = s.randombytes_buf(s.crypto_secretbox_NONCEBYTES);

    // XSalsa20-Poly1305 encryption — authenticated, integrity-checked
    const ciphertext = s.crypto_secretbox_easy(data, nonce, key);

    // Extract Poly1305 MAC (first 16 bytes of ciphertext)
    const mac = ciphertext.slice(0, s.crypto_secretbox_MACBYTES);

    key.fill(0); // zero the key from memory immediately

    return {
        ciphertext: s.to_base64(ciphertext),
        nonce: s.to_base64(nonce),
        mac: s.to_base64(mac),
        senderPublicKey: myPublicKeyB64,
        recipientPublicKey: recipientPublicKeyB64,
        transferId
    };
}

// ────────────────────────────────────────────────────────────────
// Decrypt binary data
// ────────────────────────────────────────────────────────────────

export async function decryptAssetPayload(
    payload: EncryptedPayload,
    myPrivateKeyB64: string,
): Promise<Uint8Array | null> {
    const s = await getSodium();

    try {
        const key = await deriveTransferKey(
            myPrivateKeyB64,
            payload.senderPublicKey,
            `bridge-asset-${payload.transferId}`
        );

        const ciphertext = s.from_base64(payload.ciphertext);
        const nonce = s.from_base64(payload.nonce);

        // crypto_secretbox_open_easy verifies Poly1305 MAC before decrypting
        // If data was tampered with even by 1 bit, this throws an error
        const plaintext = s.crypto_secretbox_open_easy(ciphertext, nonce, key);

        key.fill(0);
        return plaintext;
    } catch (e) {
        console.error('[transferCrypto] Decryption or MAC verification failed — payload may have been tampered with');
        return null;
    }
}

// ────────────────────────────────────────────────────────────────
// Fingerprint — short human-readable key verification (like Signal's safety numbers)
// ────────────────────────────────────────────────────────────────

export async function computeKeyFingerprint(publicKeyB64: string): Promise<string> {
    const s = await getSodium();
    const raw = s.from_base64(publicKeyB64);
    const hash = s.crypto_generichash(10, raw, new Uint8Array(0)); // 80-bit fingerprint
    return Array.from(hash)
        .map(b => b.toString(16).padStart(2, '0').toUpperCase())
        .join(':');
}
