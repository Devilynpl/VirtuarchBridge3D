import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
    try {
        const { email, token, newPassword } = await req.json();

        if (!email || !token || !newPassword) {
            return NextResponse.json({ error: 'Missing email, token, or password' }, { status: 400 });
        }

        const user = await prisma.user.findFirst({
            where: {
                email,
                verification_code: token,
                verification_expires: { gt: new Date() }
            }
        });

        if (!user) {
            return NextResponse.json({ error: 'Nieprawidłowy lub wygasły kod / Invalid or expired code' }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                password_hash: hashedPassword,
                verification_code: null,
                verification_expires: null,
                is_verified: true, // Auto verify if they reset password
            }
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Reset password error:', error);
        return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
    }
}
