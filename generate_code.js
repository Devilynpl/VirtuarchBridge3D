const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

function generateCode() {
    // Format: INDIE-XXXX-XXXX-XXXX (12 random hex chars split into groups)
    const rand = crypto.randomBytes(6).toString('hex').toUpperCase(); // 12 chars
    const part1 = rand.substring(0, 4);
    const part2 = rand.substring(4, 8);
    const part3 = rand.substring(8, 12);
    return `INDIE-${part1}-${part2}-${part3}`;
}

async function main() {
    const code = generateCode();
    
    try {
        const result = await prisma.activationCode.create({
            data: {
                code: code,
                tier: 'INDIE',
                is_used: false
            }
        });
        console.log('GENERATED_CODE:' + result.code);
    } catch (e) {
        console.error('Error generating code:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
