const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const users = await prisma.user.findMany({
        where: {
            username: { in: ['beta001', 'beta002', 'beta003'] }
        }
    });
    console.log(JSON.stringify(users, null, 2));
    await prisma.$disconnect();
}

check();
