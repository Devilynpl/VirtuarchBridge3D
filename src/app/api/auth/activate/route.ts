import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

interface AuthUser {
    id: string;
    username: string;
    email: string;
    is_active: boolean;
    tier: string;
    channel?: string;
}

export async function POST(req: NextRequest) {
    const user = (await verifyAuth(req)) as unknown as AuthUser | null;
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { code } = (await req.json()) as { code: string };

        if (!code) {
            return NextResponse.json({ error: 'Missing activation code' }, { status: 400 });
        }

        const activationCode = await prisma.activationCode.findUnique({
            where: { code }
        });

        if (!activationCode) {
            return NextResponse.json({ error: 'Invalid activation code' }, { status: 404 });
        }

        if (activationCode.is_used) {
            return NextResponse.json({ error: 'Activation code already used' }, { status: 400 });
        }

        // Transaction to ensure atomicity
        await prisma.$transaction([
            prisma.activationCode.update({
                where: { id: activationCode.id },
                data: {
                    is_used: true,
                    used_at: new Date(),
                    user_id: user.id
                }
            }),
            prisma.user.update({
                where: { id: user.id },
                data: {
                    is_active: true,
                    tier: activationCode.tier,
                    channel: activationCode.channel
                }
            })
        ]);

        return NextResponse.json({ success: true, message: 'Account activated successfully' });
    } catch (error: any) {
        console.error('Activation error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
