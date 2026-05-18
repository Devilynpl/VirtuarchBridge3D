const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const users = await prisma.user.findMany({
        select: { username: true, email: true }
    });
    console.log(JSON.stringify(users, null, 2));
    await prisma.$disconnect();
}

check();
