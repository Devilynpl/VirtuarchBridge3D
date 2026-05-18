import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { generateKeyPair, getShortMachineId } from '@/lib/crypto-engine';

/**
 * 🔑 Auth Keys API — RSA Keypair Management
 * 
 * POST: Generate a new RSA-2048 keypair for the authenticated user.
 *       Stores the public key in the database.
 *       Returns both keys — the private key MUST be saved locally by the client.
 * 
 * GET:  Retrieve the user's public key (for buyers to verify signatures).
 */

export async function POST(request: NextRequest) {
    const user = await verifyAuth(request);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const userId = (user as any).id;

        // Generate new RSA-2048 keypair
        const keyPair = generateKeyPair();
        const machineId = getShortMachineId();

        // Store public key in the database
        await prisma.user.update({
            where: { id: userId },
            data: { public_key: keyPair.publicKey }
        });

        console.log(`[AuthKeys] Generated RSA-2048 keypair for user ${userId} on machine ${machineId}`);

        return NextResponse.json({
            success: true,
            publicKey: keyPair.publicKey,
            privateKey: keyPair.privateKey, // Client MUST save this securely!
            machineId,
            algorithm: 'RSA-2048',
            warning: 'SAVE YOUR PRIVATE KEY! It cannot be recovered from the server.'
        });

    } catch (error: any) {
        console.error('Key Generation Error:', error);
        return NextResponse.json({ error: 'Key generation failed' }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'userId parameter required' }, { status: 400 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { public_key: true, username: true }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({
            userId,
            username: user.username,
            publicKey: user.public_key || null,
            hasKey: !!user.public_key
        });

    } catch (error: any) {
        console.error('Key Retrieval Error:', error);
        return NextResponse.json({ error: 'Failed to retrieve key' }, { status: 500 });
    }
}
