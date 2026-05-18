import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '@/lib/auth';

export async function POST(req: Request) {
    try {
        const { email, code } = await req.json()

        if (!email || !code) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const user = await prisma.user.findUnique({
            where: { email }
        })

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        if (user.is_verified) {
            return NextResponse.json({ error: 'User already verified' }, { status: 400 })
        }

        if (user.verification_code !== code) {
            return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
        }

        if (user.verification_expires && new Date() > user.verification_expires) {
            return NextResponse.json({ error: 'Verification code expired' }, { status: 400 })
        }

        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: {
                is_verified: true,
                verification_code: null,
                verification_expires: null,
                status: 'online'
            }
        })

        const token = jwt.sign(
            {
                userId: updatedUser.id,
                username: updatedUser.username,
                peer_id: updatedUser.peer_id,
                is_active: updatedUser.is_active
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        )

        const { password_hash, ...userWithoutPassword } = updatedUser

        return NextResponse.json({ user: userWithoutPassword, token }, { status: 200 })
    } catch (error) {
        console.error('Verification error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
