const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const email = 'morbidnoizz@gmail.com';
    const newPassword = 'Alamahiv123';

    console.log(`Resetting password for ${email}...`);

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    try {
        // First check if user exists to provide better error message
        const existing = await prisma.user.findUnique({ where: { email } });
        if (!existing) {
            console.error(`User with email ${email} not found.`);
            return;
        }

        const user = await prisma.user.update({
            where: { email: email },
            data: { password_hash: hashedPassword },
        });
        console.log(`Password successfully updated for user: ${user.username}`);
    } catch (e) {
        console.error('Error updating password:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
