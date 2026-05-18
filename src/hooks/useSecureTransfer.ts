'use client';

/**
 * useSecureTransfer — React hook
 *
 * Provides:
 *   sendEncryptedAssets(assetIds, recipientPublicKey, conversationId) → sends encrypted ZIP
 *   receiveEncryptedAssets(payload)                                    → downloads + decrypts + saves ZIP
 *
 * The hook uses JSZip (already in deps) to pack assets, then transferCrypto to encrypt.
 */

import { useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { encryptAssetPayload, decryptAssetPayload, computeKeyFingerprint } from '@/lib/transferCrypto';
import toast from 'react-hot-toast';

interface SecureTransferMeta {
    type: 'secure_transfer';
    transferId: string;
    senderPublicKey: string;
    recipientPublicKey: string;
    nonce: string;
    mac: string;
    assetName: string;
    sizeBytes: number;
    createdAt: string;
}

export function useSecureTransfer() {
    const { user, keyPair, token } = useAuth();
    const [isSending, setIsSending] = useState(false);
    const [isReceiving, setIsReceiving] = useState(false);
    const [progress, setProgress] = useState(0);

    /**
     * SENDER SIDE
     * Fetches asset files, zips them, encrypts with recipient's public key, uploads blob.
     */
    const sendEncryptedAssets = useCallback(async (
        assetPaths: string[],           // local file paths the server will zip
        assetIds: string[],
        assetName: string,
        recipientPublicKeyB64: string,
        conversationId: string
    ) => {
        if (!keyPair || !user) {
            toast.error('No keypair — cannot send securely');
            return null;
        }

        if (!recipientPublicKeyB64) {
            toast.error('Recipient has no public key — cannot establish encrypted channel');
            return null;
        }

        setIsSending(true);
        setProgress(0);

        try {
            // 1. Ask server to pack the assets into a ZIP (server still can't decrypt the result)
            const packRes = await fetch('/api/transfer/pack', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ assetIds })
            });
            if (!packRes.ok) throw new Error('Failed to pack assets');
            const { fileName } = await packRes.json();

            setProgress(20);

            // 2. Download the raw ZIP bytes to the client
            const downloadRes = await fetch(`/api/transfer/download?file=${encodeURIComponent(fileName)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!downloadRes.ok) throw new Error('Failed to download packed assets');
            const zipBytes = new Uint8Array(await downloadRes.arrayBuffer());

            setProgress(50);

            // 3. Generate a unique transfer ID
            const transferId = crypto.randomUUID();

            // 4. Encrypt entirely on the client:
            //    Key = ECDH(myPrivKey + recipientPubKey) + HKDF-BLAKE2b
            //    Cipher = XSalsa20-Poly1305
            const payload = await encryptAssetPayload(
                zipBytes,
                keyPair.privateKey,
                keyPair.publicKey,
                recipientPublicKeyB64,
                transferId
            );

            setProgress(75);

            // 5. Upload the opaque encrypted blob — server stores it but CAN'T read it
            const uploadRes = await fetch('/api/transfer/secure-pack', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    ...payload,
                    conversationId,
                    assetName,
                    sizeBytes: payload.ciphertext.length
                })
            });

            if (!uploadRes.ok) throw new Error('Failed to upload encrypted payload');

            setProgress(100);

            const recipientFingerprint = await computeKeyFingerprint(recipientPublicKeyB64);
            toast.success(`🔐 Pakiet zaszyfrowany i wysłany!\nOdcisk klucza odbiorcy: ${recipientFingerprint}`);

            return payload;

        } catch (err: any) {
            console.error('[useSecureTransfer] send error:', err);
            toast.error(`Błąd wysyłki: ${err.message}`);
            return null;
        } finally {
            setIsSending(false);
            setProgress(0);
        }
    }, [keyPair, user, token]);

    /**
     * RECEIVER SIDE
     * Downloads the encrypted blob, decrypts with own private key + sender's public key.
     * Saves the decrypted ZIP to disk via save dialog.
     */
    const receiveEncryptedAssets = useCallback(async (meta: SecureTransferMeta) => {
        if (!keyPair || !user) {
            toast.error('No keypair — cannot decrypt');
            return;
        }

        // Verify this transfer is addressed to us
        if (meta.recipientPublicKey !== keyPair.publicKey) {
            toast.error('Ten transfer nie jest adresowany do Ciebie');
            return;
        }

        setIsReceiving(true);
        setProgress(0);

        try {
            // 1. Download the encrypted blob from server
            const blobRes = await fetch(`/api/transfer/secure-pack?transferId=${meta.transferId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!blobRes.ok) throw new Error('Nie można pobrać zaszyfrowanego pakietu');

            const ciphertextBytes = new Uint8Array(await blobRes.arrayBuffer());
            setProgress(40);

            // Re-assemble the payload structure
            const payload = {
                ciphertext: btoa(String.fromCharCode(...ciphertextBytes)),
                nonce: meta.nonce,
                mac: meta.mac,
                senderPublicKey: meta.senderPublicKey,
                recipientPublicKey: meta.recipientPublicKey,
                transferId: meta.transferId
            };

            // 2. Decrypt locally — throws if MAC fails (tamper detection)
            const decryptedBytes = await decryptAssetPayload(payload, keyPair.privateKey);
            if (!decryptedBytes) {
                toast.error('❌ Weryfikacja integralności nie powiodła się — dane mogły zostać zmodyfikowane!');
                return;
            }

            setProgress(80);

            // 3. Trigger browser save dialog for the decrypted ZIP
            const blob = new Blob([decryptedBytes as any], { type: 'application/zip' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${meta.assetName || 'assets'}.zip`;
            a.click();
            URL.revokeObjectURL(url);

            setProgress(100);

            // 4. Tell server to purge the blob (no lingering encrypted data)
            await fetch(`/api/transfer/secure-pack?transferId=${meta.transferId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });

            const senderFingerprint = await computeKeyFingerprint(meta.senderPublicKey);
            toast.success(`✅ Odszyfrowano i pobrano!\nNadawca (klucz): ${senderFingerprint}`);

        } catch (err: any) {
            console.error('[useSecureTransfer] receive error:', err);
            toast.error(`Błąd odbioru: ${err.message}`);
        } finally {
            setIsReceiving(false);
            setProgress(0);
        }
    }, [keyPair, user, token]);

    return {
        sendEncryptedAssets,
        receiveEncryptedAssets,
        isSending,
        isReceiving,
        progress
    };
}
