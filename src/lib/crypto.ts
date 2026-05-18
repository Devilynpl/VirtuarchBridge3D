import _sodium from 'libsodium-wrappers';

let sodium: typeof _sodium;

export const initSodium = async () => {
    if (sodium) return sodium;
    await _sodium.ready;
    sodium = _sodium;
    return sodium;
};

export interface KeyPair {
    publicKey: string; // base64
    privateKey: string; // base64
}

/**
 * Generates a new X25519 key pair for public-key encryption.
 */
export const generateKeyPair = async (): Promise<KeyPair> => {
    const s = await initSodium();
    const keys = s.crypto_box_keypair();
    return {
        publicKey: s.to_base64(keys.publicKey),
        privateKey: s.to_base64(keys.privateKey)
    };
};

/**
 * Encrypts a message using the recipient's public key and the sender's private key.
 * @returns { cipherText: string, nonce: string } base64 encoded strings
 */
export const encryptMessage = async (
    message: string,
    recipientPublicKeyBase64: string,
    senderPrivateKeyBase64: string
) => {
    const s = await initSodium();
    const recipientPubKey = s.from_base64(recipientPublicKeyBase64);
    const senderPrivKey = s.from_base64(senderPrivateKeyBase64);
    const nonce = s.randombytes_buf(s.crypto_box_NONCEBYTES);

    const cipherText = s.crypto_box_easy(
        message,
        nonce,
        recipientPubKey,
        senderPrivKey
    );

    return {
        cipherText: s.to_base64(cipherText),
        nonce: s.to_base64(nonce)
    };
};

/**
 * Decrypts a message using the sender's public key and the recipient's private key.
 */
export const decryptMessage = async (
    cipherTextBase64: string,
    nonceBase64: string,
    senderPublicKeyBase64: string,
    recipientPrivateKeyBase64: string
) => {
    try {
        const s = await initSodium();
        const cipherText = s.from_base64(cipherTextBase64);
        const nonce = s.from_base64(nonceBase64);
        const senderPubKey = s.from_base64(senderPublicKeyBase64);
        const recipientPrivKey = s.from_base64(recipientPrivateKeyBase64);

        const decrypted = s.crypto_box_open_easy(
            cipherText,
            nonce,
            senderPubKey,
            recipientPrivKey
        );

        return s.to_string(decrypted);
    } catch (e) {
        console.error('Decryption failed:', e);
        return null;
    }
};
