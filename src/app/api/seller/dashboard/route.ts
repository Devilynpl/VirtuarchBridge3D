import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
    const user = await verifyAuth(request);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // 1. Fetch all assets owned by the user (as a seller)
        const myAssets = await prisma.userAsset.findMany({
            where: { user_id: (user as any).id },
            include: {
                licenses: {
                    include: {
                        user: { select: { username: true, email: true } },
                        contract: true,
                        key_grants: true
                    }
                }
            }
        }) as any[];

        // 2. Aggregate Stats
        let totalSales = 0;
        let activeContracts = 0;
        let totalPotentialRoyalty = 0;
        const categoryStats: Record<string, number> = {};

        const processedAssets = myAssets.map(asset => {
            const assetSales = asset.licenses.filter((l: any) => l.type === 'STANDARD').length;
            const assetContracts = asset.licenses.filter((l: any) => l.type === 'DEFERRED').length;

            totalSales += assetSales;
            activeContracts += assetContracts;

            asset.categories.forEach((cat: string) => {
                categoryStats[cat] = (categoryStats[cat] || 0) + (assetSales + assetContracts);
            });

            return {
                id: asset.id,
                name: asset.name,
                type: asset.type,
                revenueModel: asset.revenue_model,
                stats: {
                    sales: assetSales,
                    contracts: assetContracts
                },
                licenses: asset.licenses.map((l: any) => ({
                    id: l.id,
                    username: l.user.username,
                    type: l.type,
                    status: l.status,
                    createdAt: l.created_at,
                    hasContract: !!l.contract,
                    contractDetails: l.contract,
                    grantsCount: l.key_grants.length
                }))
            };
        });

        // 3. Category distribution for charts
        const categories = Object.entries(categoryStats).map(([name, count]) => ({ name, count }));

        return NextResponse.json({
            stats: {
                totalSales,
                activeContracts,
                totalAssets: myAssets.length,
                potentialRoyalty: activeContracts * 2500, // Placeholder calculation: avg 2.5k per successful game
            },
            categories,
            assets: processedAssets
        });

    } catch (error) {
        console.error('Seller Dashboard Error:', error);
        return NextResponse.json({ error: 'Failed to fetch seller data' }, { status: 500 });
    }
}
