const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function generateCodes(count = 5) {
    const codes = [];
    for (let i = 0; i < count; i++) {
        const code = `BRDG-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        codes.push(code);
    }

    console.log('Generating codes:', codes);

    for (const code of codes) {
        await prisma.activationCode.create({
            data: {
                code: code,
                is_used: false
            }
        });
    }

    console.log('Success! Codes saved to database.');
    process.exit(0);
}

generateCodes();
