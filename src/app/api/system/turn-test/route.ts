import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getIceConfigSummary } from '@/lib/p2pConfig';
import { getConfig } from '@/lib/config';

export async function GET(request: Request) {
    try {
        const auth = await verifyAuth(request);
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const appConfig = await getConfig();
        const summary = getIceConfigSummary(appConfig);

        return NextResponse.json({
            status: 'success',
            configured: summary.turnCount > 0,
            summary: {
                turn_servers_count: summary.turnCount,
                stun_servers_count: summary.stunCount,
                using_custom_credentials: summary.hasCustom,
                provider_status: summary.hasCustom ? 'Private TURN' : 'Public Infrastructure'
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('TURN status check failed:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
