import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

export async function GET(req: Request) {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // In a real app, check if user.tier === 'ADMIN' or similar.
    // For now, we allow authenticated users to see stats as requested.

    try {
        const [
            userCount,
            assetCount,
            channelCount,
            messageCount,
            attachmentStats,
            requestStats
        ] = await Promise.all([
            prisma.user.count(),
            prisma.userAsset.count(),
            prisma.conversation.count({ where: { type: 'channel' } }),
            prisma.message.count(),
            prisma.attachment.aggregate({
                _sum: {
                    file_size: true
                },
                _count: true
            }),
            prisma.assetRequest.groupBy({
                by: ['status'],
                _count: true
            })
        ]);

        // Convert BigInt to number for JSON serialization
        const totalBytes = Number(attachmentStats._sum.file_size || 0);
        const totalGB = (totalBytes / (1024 * 1024 * 1024)).toFixed(2);

        // Process request stats
        const pendingRequests = requestStats.find(s => s.status === 'pending')?._count || 0;
        const fulfilledRequests = requestStats.find(s => s.status === 'fulfilled')?._count || 0;

        return NextResponse.json({
            users: userCount,
            assets: assetCount,
            channels: channelCount,
            messages: messageCount,
            storage: {
                bytes: totalBytes,
                gb: totalGB,
                count: attachmentStats._count
            },
            requests: {
                pending: pendingRequests,
                fulfilled: fulfilledRequests,
                total: pendingRequests + fulfilledRequests
            }
        });

    } catch (error) {
        console.error('Admin Stats Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
