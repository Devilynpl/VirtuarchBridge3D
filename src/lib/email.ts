import nodemailer from 'nodemailer';

export async function sendEmail(to: string, code: string) {
    // For development, we'll log the code.
    // In production, configure SMTP.
    console.log(`[EMAIL_VERIFICATION] To: ${to}, Code: ${code}`);

    try {
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
            console.log('No EMAIL_USER provided. Creating Ethereal test account...');
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
            to,
            subject: 'Your Verification Code',
            text: `Your verification code is: ${code}. It will expire in 10 minutes.`,
            html: `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #38bdf8;">3D BRIDGE Verification</h2>
                    <p>Enter the following code to complete your registration:</p>
                    <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #38bdf8; margin: 20px 0;">
                        ${code}
                    </div>
                    <p style="color: #666; font-size: 12px;">This code will expire in 10 minutes.</p>
                </div>
            `,
        });

        if (!process.env.EMAIL_USER) {
            console.log('Email sent using Ethereal!');
            console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
        }

        return true;
    } catch (error) {
        console.error('Email send error:', error);
        return false;
    }
}
