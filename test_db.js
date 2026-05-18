const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
    try {
        console.log('--- Testing Database Connection ---');
        const user = await prisma.user.create({
            data: {
                username: 'testuser_' + Date.now(),
                email: 'test' + Date.now() + '@example.com',
                password_hash: 'test_hash'
            }
        });
        console.log('✅ Created user:', user.username);

        const found = await prisma.user.findUnique({
            where: { id: user.id }
        });
        console.log('✅ Found user by ID:', found ? found.username : 'Not found');

        await prisma.user.delete({
            where: { id: user.id }
        });
        console.log('✅ Deleted test user');
        console.log('--- DB TEST PASSED ---');
    } catch (err) {
        console.error('❌ DB TEST FAILED');
        console.error(err);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

test();
