const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const general = await prisma.conversation.upsert({
        where: { id: '00000000-0000-0000-0000-000000000001' },
        update: {},
        create: {
            id: '00000000-0000-0000-0000-000000000001',
            name: 'General Chat',
            type: 'channel',
            is_private: false,
        }
    });
    console.log('Created/Upserted General Chat:', general.id);
}

main().catch(console.error).finally(() => prisma.$disconnect());
