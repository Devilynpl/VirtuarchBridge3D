require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');

const prisma = new PrismaClient();

async function main() {
    const email = 'morbidnoizz@gmail.com';
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();

    console.log(`Generating code for ${email}: ${code}`);

    // Update DB
    await prisma.user.update({
        where: { email },
        data: {
            verification_code: code,
            verification_expires: new Date(Date.now() + 10 * 60 * 1000) // 10 mins
        }
    });

    // Send Email
    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: Number(process.env.EMAIL_PORT),
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    try {
        await transporter.sendMail({
            from: '"3D BRIDGE" <3dbridge.hub@gmail.com>',
            to: email,
            subject: 'Asset Bridge Verification Code',
            text: `Your verification code is: ${code}`,
            html: `<h1>Your verification code is: <b>${code}</b></h1>`
        });
        console.log('Verification email sent successfully!');
    } catch (e) {
        console.error('Failed to send email:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
