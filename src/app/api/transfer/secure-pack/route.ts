import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { verifyAuth } from '@/lib/auth';
import { getLibraryPath } from '@/lib/config';
import prisma from '@/lib/prisma';

/**
 * POST /api/transfer/secure-pack
 *
 * Stores an encrypted asset payload. The server is a dumb relay:
 * it only stores the ciphertext blob — it CANNOT decrypt it
 * because the key is derived client-side via ECDH and never transmitted.
 *
 * Body:
 *   ciphertext: string       base64-encoded encrypted ZIP
 *   nonce: string            base64-encoded 24-byte random nonce
 *   mac: string              base64-encoded Poly1305 MAC for integrity check
 *   senderPublicKey: string  sender's X25519 public key (base64)
 *   recipientPublicKey: string
 *   transferId: string       UUID for this transfer session
 *   conversationId: string   which channel this belongs to
 *   assetName: string        human-readable label
 *   sizeBytes: number        encrypted payload size
 */
export async function POST(req: NextRequest) {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const {
            ciphertext,
            nonce,
            mac,
            senderPublicKey,
            recipientPublicKey,
            transferId,
            conversationId,
            assetName,
            sizeBytes
        } = body;

        if (!ciphertext || !nonce || !mac || !senderPublicKey || !recipientPublicKey || !transferId || !conversationId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Validate sizes — max 256MB encrypted payload
        if (typeof sizeBytes === 'number' && sizeBytes > 256 * 1024 * 1024) {
            return NextResponse.json({ error: 'Payload too large (max 256MB)' }, { status: 413 });
        }

        // Store ciphertext on disk (not in DB to avoid column size limits)
        const LIBRARY_PATH = await getLibraryPath();
        if (!LIBRARY_PATH) return NextResponse.json({ error: 'Library path not set' }, { status: 500 });

        const transfersDir = path.join(LIBRARY_PATH, 'secure_transfers');
        await fs.mkdir(transfersDir, { recursive: true });

        const blobPath = path.join(transfersDir, `${transferId}.enc`);
        const blobBuffer = Buffer.from(ciphertext, 'base64');

        // Basic path traversal check
        if (!blobPath.startsWith(transfersDir)) {
            return NextResponse.json({ error: 'Invalid transfer ID' }, { status: 400 });
        }

        await fs.writeFile(blobPath, blobBuffer);

        // Store metadata in DB (no key, no plaintext — just routing info)
        // Using the Message table to post a system message with transfer metadata
        const metadataJson = JSON.stringify({
            type: 'secure_transfer',
            transferId,
            senderPublicKey,
            recipientPublicKey,
            nonce,        // nonce is NOT secret — it just prevents replay
            mac,          // MAC allows recipient to verify integrity before decrypt
            assetName: assetName || 'Asset Pack',
            sizeBytes,
            createdAt: new Date().toISOString()
        });

        await prisma.message.create({
            data: {
                conversation_id: conversationId,
                sender_id: user.userId as string,
                type: 'secure_transfer',
                content: `🔐 Encrypted Asset Pack: ${assetName || 'Asset Pack'}`,
                metadata: metadataJson
            }
        });

        return NextResponse.json({
            success: true,
            transferId,
            message: 'Encrypted payload stored. Recipient can now download and decrypt.'
        });

    } catch (err: any) {
        console.error('[secure-pack] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}


/**
 * GET /api/transfer/secure-pack?transferId=xxx
 *
 * Returns the raw encrypted ciphertext bytes for the client to decrypt locally.
 * Server cannot read the contents — it's an opaque blob.
 */
export async function GET(req: NextRequest) {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const transferId = searchParams.get('transferId');

    if (!transferId || transferId.includes('..') || transferId.includes('/')) {
        return NextResponse.json({ error: 'Invalid transferId' }, { status: 400 });
    }

    try {
        const LIBRARY_PATH = await getLibraryPath();
        if (!LIBRARY_PATH) return NextResponse.json({ error: 'Library path not set' }, { status: 500 });

        const blobPath = path.join(LIBRARY_PATH, 'secure_transfers', `${transferId}.enc`);

        // Verify path is within our transfers dir
        const transfersDir = path.join(LIBRARY_PATH, 'secure_transfers');
        if (!blobPath.startsWith(transfersDir)) {
            return NextResponse.json({ error: 'Invalid transferId' }, { status: 400 });
        }

        const blobBuffer = await fs.readFile(blobPath);

        // Stream raw bytes back — Content-Type signals it's opaque binary
        return new Response(blobBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Length': blobBuffer.byteLength.toString(),
                'X-Bridge-Encrypted': 'true',
                // No Content-Disposition so browser doesn't auto-download
            }
        });
    } catch (err: any) {
        if (err.code === 'ENOENT') {
            return NextResponse.json({ error: 'Transfer not found or expired' }, { status: 404 });
        }
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}


/**
 * DELETE /api/transfer/secure-pack?transferId=xxx
 *
 * Caller cleans up after successful decryption — no lingering blobs on server.
 */
export async function DELETE(req: NextRequest) {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const transferId = searchParams.get('transferId');

    if (!transferId || transferId.includes('..') || transferId.includes('/')) {
        return NextResponse.json({ error: 'Invalid transferId' }, { status: 400 });
    }

    try {
        const LIBRARY_PATH = await getLibraryPath();
        if (!LIBRARY_PATH) return NextResponse.json({ error: 'Library path not set' }, { status: 500 });

        const blobPath = path.join(LIBRARY_PATH, 'secure_transfers', `${transferId}.enc`);
        const transfersDir = path.join(LIBRARY_PATH, 'secure_transfers');
        if (!blobPath.startsWith(transfersDir)) {
            return NextResponse.json({ error: 'Invalid transferId' }, { status: 400 });
        }

        await fs.unlink(blobPath).catch(() => { });

        return NextResponse.json({ success: true, message: 'Transfer blob purged from server.' });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
