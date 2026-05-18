import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { verifyAuth } from '@/lib/auth';

export async function POST(req: Request) {
    try {
        const user = await verifyAuth(req);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { subject, description, steps } = await req.json();

        if (!description || !subject) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: Number(process.env.EMAIL_PORT),
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const mailOptions = {
            from: process.env.EMAIL_FROM,
            to: '3dbridge@virtuarch.pl',
            subject: `[Bug Report] ${subject}`,
            text: `
Bug Report from User: ${user.userId}

Subject: ${subject}

Description:
${description}

Steps to Reproduce:
${steps || 'N/A'}
            `,
        };

        await transporter.sendMail(mailOptions);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error sending bug report:', error);
        return NextResponse.json({ error: 'Failed to send bug report' }, { status: 500 });
    }
}
