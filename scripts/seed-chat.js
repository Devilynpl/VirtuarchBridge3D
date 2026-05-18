const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PUBLIC_CONV_ID = '00000000-0000-0000-0000-000000000001';

async function seed() {
    try {
        const existing = await prisma.conversation.findUnique({
            where: { id: PUBLIC_CONV_ID }
        });

        if (!existing) {
            console.log('Public channel missing. Creating...');
            await prisma.conversation.create({
                data: {
                    id: PUBLIC_CONV_ID,
                    type: 'channel',
                    name: 'General Chat',
                    description: 'Public channel for all users',
                    is_private: false
                }
            });
            console.log('Public channel created successfully.');
        } else {
            console.log('Public channel already exists.');
        }
    } catch (err) {
        console.error('Error seeding database:', err);
    } finally {
        await prisma.$disconnect();
    }
}

seed();
