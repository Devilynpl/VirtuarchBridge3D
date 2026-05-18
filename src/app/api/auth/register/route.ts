import prisma from '../../../../lib/prisma'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

import { JWT_SECRET } from '@/lib/auth';
import { getConfig } from '@/lib/config';

import { rateLimit } from '@/lib/rate-limit';

export async function POST(req: Request) {
    try {
        const config = await getConfig();
        if (config.enableRegistration === false) {
            return NextResponse.json({ error: 'Registration is currently disabled by administrator' }, { status: 403 });
        }

        const { username, email, password } = await req.json()

        // Beta mode check removed for registration unlock
        if (!username || !email || !password) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { username: username },
                    { email: email }
                ]
            }
        })

        if (existingUser) {
            return NextResponse.json({ error: 'User already exists' }, { status: 409 })
        }

        const hashedPassword = await bcrypt.hash(password, 10)
        const isBetaDirect = email.endsWith('@beta.local');

        // Generate an 8-character verification code
        const verificationCode = Math.random().toString(36).substring(2, 10).toUpperCase()
        const expires = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

        // Generate a friendly Peer ID: BRIDGE-XXXX
        const peerId = `BRIDGE-${Math.random().toString(36).substring(2, 6).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`

        // Generate Request Codes
        const generateRequestCode = (tier: string) => `${tier}_${Math.random().toString(36).substring(2, 6).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const indieRequestCode = generateRequestCode("INDIE");
        const studioRequestCode = generateRequestCode("STUDIO");

        const user = await prisma.user.create({
            data: {
                username,
                email,
                password_hash: hashedPassword,
                peer_id: peerId,
                status: isBetaDirect ? 'online' : 'offline',
                is_verified: isBetaDirect,
                verification_code: verificationCode,
                verification_expires: expires,
                indie_request_code: indieRequestCode,
                studio_request_code: studioRequestCode
            }
        })

        if (isBetaDirect) {
            const token = jwt.sign(
                { userId: user.id, username: user.username, peer_id: user.peer_id, is_active: true },
                JWT_SECRET,
                { expiresIn: '7d' }
            );

            return NextResponse.json({
                message: 'Instant register successful',
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    peer_id: user.peer_id,
                    status: user.status
                },
                requiresVerification: false
            }, { status: 201 });
        }

        // Send the email ONLY if we are not beta-direct and presumably not in local dev mode when email is not configured
        try {
            const { sendEmail } = await import('@/lib/email');
            await sendEmail(email, verificationCode);
        } catch (e) {
            console.warn('Could not send email, bypassing:', e);
            // In dev environment or unconfigured environments, fall back gracefully
        }

        return NextResponse.json({
            message: 'Verification code sent to your email (or bypassed in dev mode)',
            email: email,
            requiresVerification: true
        }, { status: 201 })
    } catch (error) {
        console.error('Registration error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
