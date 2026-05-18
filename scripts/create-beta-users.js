const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
    const password = 'beta2026';
    const hashedPassword = await bcrypt.hash(password, 10);

    const users = [
        { username: 'beta001', email: 'beta001@beta.pl' },
        { username: 'beta002', email: 'beta002@beta.pl' },
        { username: 'beta003', email: 'beta003@beta.pl' }
    ];

    for (const u of users) {
        const existing = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: u.email },
                    { username: u.username }
                ]
            }
        });

        if (existing) {
            await prisma.user.update({
                where: { id: existing.id },
                data: {
                    email: u.email,
                    username: u.username,
                    is_active: true,
                    is_verified: true
                }
            });
            console.log(`Updated user ${u.username}`);
        } else {
            await prisma.user.create({
                data: {
                    username: u.username,
                    email: u.email,
                    password_hash: hashedPassword,
                    peer_id: `peer-${u.username}-${Date.now()}`,
                    is_active: true,
                    is_verified: true
                }
            });
            console.log(`Created user ${u.username}`);
        }
    }

    await prisma.$disconnect();
}

main().catch(console.error);
