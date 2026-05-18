const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const email = 'morbidnoizz@gmail.com';
    console.log(`Manually verifying user: ${email}...`);

    try {
        const user = await prisma.user.update({
            where: { email },
            data: {
                is_verified: true,
                status: 'online'
            }
        });
        console.log(`SUCCESS: User ${user.username} is now VERIFIED.`);
    } catch (e) {
        console.error('Error verifying user:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
