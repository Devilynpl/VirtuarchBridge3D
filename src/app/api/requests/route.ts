import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth';
import { getAssets } from '@/lib/assets';

const DEFAULT_CONV_ID = '00000000-0000-0000-0000-000000000001';

import { rateLimit } from '@/lib/rate-limit';

interface AuthUser {
    userId: string;
    is_active: boolean;
}

export async function POST(req: Request) {
    if (rateLimit(req as any)) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }
    const user = (await verifyAuth(req)) as unknown as AuthUser | null;

    if (!user?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = user.userId as string;

    try {
        const { asset_name, asset_code, description, conversation_id } = await req.json()

        if (!asset_name && !asset_code) return NextResponse.json({ error: 'Asset name or code is required' }, { status: 400 })

        const convId = conversation_id || DEFAULT_CONV_ID;

        // Check validation if asset_code provided
        if (asset_code) {
            const assets = await getAssets();
            const asset = assets.find(a => a.id === asset_code);
            if (!asset) {
                // Relaxed validation: just warn or allow? 
                // If the user manually typed it, it might be invalid.
                // But let's stick to strict if code is provided.
                // Actually, existing code in other file forced it.
                // But this route allowed just asset_name. 
                // Let's validate ONLY if asset_code is provided and it looks like an ID.
                // For now, if asset_code is passed, assume it must exist.
                // But maybe the user is requesting something not in library?
                // The 'request' feature is often for things MISSING.
                // So we should NOT enforce existence in getAssets()!
                // The other file was likely for requesting "access" to an existing asset?
                // Or requesting "download"?
                // 'I need assets' usually means 'I want you to download/buy this'.
                // So it might NOT be in local library.
                // getAssets() usually returns local assets.
                // So forcing it to exist locally contradicts "I need this".
                // So I will SKIP strict validation against getAssets().
            }
        }

        // Check membership for private conversations
        if (convId !== DEFAULT_CONV_ID) {
            const member = await prisma.conversationMember.findUnique({
                where: {
                    conversation_id_user_id: {
                        conversation_id: convId,
                        user_id: userId
                    }
                }
            });
            if (!member) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        // Use transaction for consistency
        const { message, request } = await prisma.$transaction(async (tx) => {
            const msg = await tx.message.create({
                data: {
                    conversation_id: convId,
                    sender_id: userId,
                    content: `📢 ASSET REQUEST: I need "${asset_name || asset_code}"`,
                    type: 'request',
                    metadata: '{}'
                },
                include: {
                    sender: { select: { username: true, peer_id: true } }
                }
            });

            const req = await tx.assetRequest.create({
                data: {
                    asset_name: asset_name || asset_code,
                    asset_code: asset_code || 'N/A',
                    description: description || '',
                    requester_id: userId,
                    conversation_id: convId,
                    message_id: msg.id
                },
                include: {
                    requester: {
                        select: { username: true, peer_id: true }
                    }
                }
            });

            // Update metadata with requestId
            const updatedMsg = await tx.message.update({
                where: { id: msg.id },
                data: {
                    metadata: JSON.stringify({
                        requestId: req.id,
                        requesterPeerId: (msg as any).sender?.peer_id,
                        assetCode: asset_code,
                        description: description
                    })
                },
                include: {
                    sender: { select: { username: true, peer_id: true } }
                }
            });

            return { message: updatedMsg, request: req };
        });

        // Broadcast
        // @ts-ignore
        if (global.io) {
            // @ts-ignore
            global.io.to(convId).emit('new_message', message);
        }

        return NextResponse.json({ request })
    } catch (error) {
        console.error('Request error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function GET(req: Request) {
    const user = await verifyAuth(req);
    const userId = user?.userId as string | undefined;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const convId = searchParams.get('conversation_id');

    try {
        if (convId) {
            // Check membership if specific conversation requested
            if (convId !== DEFAULT_CONV_ID) {
                const member = await prisma.conversationMember.findUnique({
                    where: {
                        conversation_id_user_id: {
                            conversation_id: convId,
                            user_id: userId
                        }
                    }
                });
                if (!member) {
                    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
                }
            }

            const requests = await prisma.assetRequest.findMany({
                where: {
                    conversation_id: convId,
                    status: 'pending'
                },
                include: {
                    requester: { select: { username: true, peer_id: true } }
                },
                orderBy: { created_at: 'desc' },
                take: 50
            });
            return NextResponse.json({ requests });
        } else {
            // No specific conversation: Return requests from ALL conversations user belongs to (plus public)
            const members = await prisma.conversationMember.findMany({
                where: { user_id: userId },
                select: { conversation_id: true }
            });

            const myConvIds = [...members.map(m => m.conversation_id), DEFAULT_CONV_ID];

            const requests = await prisma.assetRequest.findMany({
                where: {
                    conversation_id: { in: myConvIds },
                    status: 'pending'
                },
                include: {
                    requester: { select: { username: true, peer_id: true } }
                },
                orderBy: { created_at: 'desc' },
                take: 50
            });
            return NextResponse.json({ requests });
        }
    } catch (error) {
        console.error('Fetch requests error:', error);
        return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
    }
}
