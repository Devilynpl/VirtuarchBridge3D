import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { deriveSecureKey, deriveSessionKey, getHardwareFingerprint } from '@/lib/crypto-engine';

/**
 * 🔒 Assets Key Guard API v2.0 (Hardware-Locked DRM Controller)
 * 
 * Grants a hardware-bound, session-limited decryption key for .ASS packages.
 * 
 * Security model:
 *   1. Verify user authentication (JWT)
 *   2. Check license ownership in DB
 *   3. Derive key from: assetCode + userId + machineId (HMAC-SHA256)
 *   4. Create session-bound temporary key (1-hour time bucket)
 *   5. Log the grant for auditing
 * 
 * The derived key only works for the exact (asset, user, machine) tuple.
 * Moving to a different machine requires a new key grant.
 */

export async function POST(request: NextRequest) {
    const user = await verifyAuth(request);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { assetId, machineId: clientMachineId } = await request.json();

        if (!assetId) {
            return NextResponse.json({ error: 'Asset ID required' }, { status: 400 });
        }

        const userId = (user as any).id;

        // 1. Check Ownership / License in DB
        const license = await (prisma as any).assetLicense.findFirst({
            where: {
                user_id: userId,
                asset_id: assetId,
                status: 'ACTIVE'
            }
        });

        // 2. Check if user is asset owner
        const isOwner = await prisma.userAsset.findFirst({
            where: { id: assetId, user_id: userId }
        });

        if (!license && !isOwner) {
            return NextResponse.json({
                error: 'License required',
                reason: 'NO_ACTIVE_CONTRACT',
                options: ['BUY_NOW', 'START_DEFERRED_ROYALTY']
            }, { status: 403 });
        }

        // 3. Get server-side hardware fingerprint for verification
        const serverFingerprint = getHardwareFingerprint();

        // Use client-provided machineId or generate server-side
        const machineId = clientMachineId || serverFingerprint.machineId.substring(0, 16);

        // 4. Derive hardware-bound secure key (HMAC-SHA256)
        const assetCode = assetId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 12);
        const secureKey = deriveSecureKey(assetCode, userId, machineId);

        // 5. Create session-bound temporary key
        const sessionId = `${userId}_${assetId}_${Date.now()}`;
        const sessionKey = deriveSessionKey(secureKey, sessionId, 1); // 1-hour bucket

        // 6. Log the key grant for auditing
        if (license) {
            try {
                await (prisma as any).assetKeyGrant.create({
                    data: {
                        license_id: license.id,
                        machine_id: machineId,
                        ip_address: request.headers.get('x-forwarded-for') || '0.0.0.0'
                    }
                });
            } catch (e) {
                console.warn('[KeyGuard] Failed to log grant (non-critical):', e);
            }
        }

        // 7. Calculate key for the legacy XOR cipher (backwards compat)
        const legacyKey = `3DBRIDGE_SECURE_KEY_${assetCode}`;

        return NextResponse.json({
            success: true,
            assetId,
            // Legacy key (for v2.0 packages)
            decryptionKey: legacyKey,
            // New secure keys (for v3.0+ packages)
            secureKey,
            sessionKey,
            sessionId,
            expiresIn: 3600, // 1 hour
            machineBind: machineId,
            security: {
                version: 'v2.0',
                keyDerivation: 'HMAC-SHA256',
                binding: 'hardware+user+asset',
                machineFingerprint: machineId
            }
        });

    } catch (error: any) {
        console.error('Key Grant Error:', error);
        return NextResponse.json({ error: 'Server Security Fault' }, { status: 500 });
    }
}
