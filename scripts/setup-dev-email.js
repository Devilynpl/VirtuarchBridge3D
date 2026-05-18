const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

async function main() {
    console.log('Creating Ethereal test account...');

    try {
        const testAccount = await nodemailer.createTestAccount();

        console.log('Ethereal Account Created!');
        console.log('User:', testAccount.user);
        console.log('Pass:', testAccount.pass);
        console.log('Preview URL:', nodemailer.getTestMessageUrl({}));

        const envPath = path.join(__dirname, '..', '.env');

        // Manually construct .env content to ensure correct format
        const envContent = `LIBRARY_PATH=e:/COPY E/2025/Megascans Library/Bridge_unofficial/Downloaded
BLENDER_PORT=28888
NEXT_PUBLIC_BLENDER_URL=http://127.0.0.1:28888
DATABASE_URL="postgresql://cgibridge:j^N&%d&kZUAJ1x0BVpwZ@pgsql01.agnat.pl:5432/cgibridge?schema=public&sslmode=no-verify"
JWT_SECRET=a92455f61bce5aab3fbde492de95760f2c6490d5294ffa98b7601a05b0da9ba1d7703c8bb9ea5ffbeef009f8988045b5b3e06cbd58c01119712940128d4f4a0b

EMAIL_HOST=${testAccount.smtp.host}
EMAIL_PORT=${testAccount.smtp.port}
EMAIL_USER=${testAccount.user}
EMAIL_PASS=${testAccount.pass}
EMAIL_FROM=noreply@3dbridge.com
EMAIL_TO=3dbridge.hub@gmail.com
EMAIL_SECURE=${testAccount.smtp.secure}
`;

        fs.writeFileSync(envPath, envContent);
        console.log('Updated .env with Ethereal credentials.');

    } catch (err) {
        console.error('Failed to create account:', err);
    }
}

main();
