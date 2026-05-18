import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
    try {
        const { email } = await req.json();

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return NextResponse.json({ success: true });
        }

        // Generate a 6-digit numeric code
        const resetToken = Math.floor(100000 + Math.random() * 900000).toString();

        await prisma.user.update({
            where: { email },
            data: {
                verification_code: resetToken,
                verification_expires: new Date(Date.now() + 10 * 60 * 1000)
            }
        });

        let transporter;
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            transporter = nodemailer.createTransport({
                host: process.env.EMAIL_HOST || 'smtp.gmail.com',
                port: Number(process.env.EMAIL_PORT) || 587,
                secure: process.env.EMAIL_SECURE === 'true',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS,
                },
            });
        } else {
            console.log('Using Ethereal for dev reset password emails...');
            const testAccount = await nodemailer.createTestAccount();
            transporter = nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass,
                },
            });
        }

        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM || '"3D BRIDGE" <no-reply@3dbridge.com>',
            to: email,
            subject: 'Reset Twojego Hasła (Password Reset)',
            text: `Twój kod do resetowania hasła to: ${resetToken}`,
            html: `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #1e293b; border-radius: 10px; background: #020617; color: white; text-align: center;">
                    <h2 style="color: #38bdf8;">Resetowanie Hasła</h2>
                    <p style="color: #94a3b8;">Wpisz poniższy kod w aplikacji, aby ustawić nowe hasło:</p>
                    <div style="font-size: 32px; font-weight: bold; letter-spacing: 4px; padding: 20px; margin: 20px 0; background: #0f172a; border-radius: 10px; border: 1px solid #38bdf8; display: inline-block;">
                        ${resetToken}
                    </div>
                </div>
            `,
        });

        if (!process.env.EMAIL_USER) {
            console.log('Ethereal preview URL: %s', nodemailer.getTestMessageUrl(info));
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Forgot password error:', error);
        return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
    }
}
