import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { JWT_SECRET } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import prisma from '../../../../lib/prisma'

// ─── BETA MODE ────────────────────────────────────────────────────────────────
// When NEXT_PUBLIC_BETA_MODE=true, only the hardcoded beta accounts work.
// No database lookup is done for them.
const BETA_MODE = process.env.NEXT_PUBLIC_BETA_MODE === 'true';
const BETA_PASSWORD = process.env.BETA_PASSWORD || 'beta14218';

// ──────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
    if (rateLimit(req as any)) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }
    try {
        const { email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // ── Auto-generate next Beta Account if generic login is used ──
        if (email.toLowerCase() === 'user_beta' && password === 'beta') {
            // Find max existing beta number
            const betaUsers = await prisma.user.findMany({
                where: { username: { startsWith: 'BETA_TESTER_' } },
                select: { username: true }
            });

            let maxNum = 0;
            for (const u of betaUsers) {
                const match = u.username.match(/^BETA_TESTER_(\d+)$/);
                if (match) {
                    const num = parseInt(match[1], 10);
                    if (num > maxNum) maxNum = num;
                }
            }
            const nextNum = maxNum + 1;

            const betaUsername = `BETA_TESTER_${nextNum}`;
            const betaEmail = `user_beta_${nextNum}@beta.local`;

            const hashedPassword = await bcrypt.hash(`beta${nextNum}`, 10);
            const peerId = `BETA-${nextNum}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

            const user = await prisma.user.create({
                data: {
                    username: betaUsername,
                    email: betaEmail,
                    password_hash: hashedPassword,
                    peer_id: peerId,
                    status: 'online',
                    is_verified: true,
                    is_active: true
                }
            });

            const token = jwt.sign(
                { userId: user.id, username: user.username, peer_id: user.peer_id, is_active: true },
                JWT_SECRET,
                { expiresIn: '7d' }
            );

            const { password_hash: ph, ...userWithoutPassword } = user;
            return NextResponse.json({
                user: userWithoutPassword,
                token
            }, { status: 200 });
        }

        // ── Dynamic Beta Accounts (BETA_TESTER_%number%) ──
        // Login format: username/email "user_beta_X" and pass "betaX"
        const betaMatch = email.match(/^user_beta_(\d+)$/i);
        if (betaMatch) {
            const num = betaMatch[1];
            if (password !== `beta${num}`) {
                return NextResponse.json({ error: 'Invalid beta password' }, { status: 401 });
            }

            const betaUsername = `BETA_TESTER_${num}`;
            const betaEmail = `user_beta_${num}@beta.local`;

            // Look up beta user by username in DB
            let user = await prisma.user.findUnique({ where: { username: betaUsername } });

            if (!user) {
                // Create user dynamically for chat to work with this user role/nick
                const hashedPassword = await bcrypt.hash(password, 10);
                const peerId = `BETA-${num}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

                user = await prisma.user.create({
                    data: {
                        username: betaUsername,
                        email: betaEmail,
                        password_hash: hashedPassword,
                        peer_id: peerId,
                        status: 'online',
                        is_verified: true,
                        is_active: true
                    }
                });
            }

            const token = jwt.sign(
                { userId: user.id, username: user.username, peer_id: user.peer_id, is_active: true },
                JWT_SECRET,
                { expiresIn: '7d' }
            );

            const { password_hash, ...userWithoutPassword } = user;
            return NextResponse.json({
                user: userWithoutPassword,
                token
            }, { status: 200 });
        }

        // ── Beta mode: block all non-beta logins ──
        if (BETA_MODE) {
            return NextResponse.json({ error: 'Beta version — use beta account' }, { status: 403 });
        }

        // ── Normal login ──
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
        }

        if (!user.is_verified) {
            return NextResponse.json({
                error: 'Email not verified',
                requiresVerification: true,
                email: user.email
            }, { status: 403 });
        }

        const token = jwt.sign(
            { userId: user.id, username: user.username, peer_id: user.peer_id, is_active: user.is_active },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        const { password_hash, ...userWithoutPassword } = user;
        return NextResponse.json({ user: userWithoutPassword, token }, { status: 200 });

    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
