import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/lib/auth';

export async function POST(req: Request) {
    try {
        const { email, username, password } = await req.json();

        if (!email || !username || !password) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const peerId = `BRIDGE-${Math.random().toString(36).substring(2, 6).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

        const user = await prisma.user.upsert({
            where: { email },
            update: {
                username,
                password_hash: hashedPassword,
                is_verified: true,
                is_active: true
            },
            create: {
                email,
                username,
                password_hash: hashedPassword,
                peer_id: peerId,
                is_verified: true,
                is_active: true,
                status: 'online'
            }
        });

        const token = jwt.sign(
            {
                userId: user.id,
                username: user.username,
                peer_id: user.peer_id,
                is_active: user.is_active
            },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        const { password_hash, ...userResult } = user;
        return NextResponse.json({ user: userResult, token });
    } catch (err) {
        console.error('Creator Login error:', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
