const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('--- Bridge Bot Seeder ---');

    const botEmail = 'bot@megascans.local';
    const botUsername = 'MegascansBot';
    const botPeerId = 'bot-mega-123';
    const botPassword = 'bot-secure-password-2026'; // Not really used but needed for schema

    // 1. Create or Find Bot User
    let bot = await prisma.user.findUnique({
        where: { email: botEmail }
    });

    if (bot) {
        bot = await prisma.user.update({
            where: { id: bot.id },
            data: {
                peer_id: botPeerId,
                username: botUsername,
                is_active: true,
                is_verified: true,
            }
        });
        console.log(`Bot updated: ${bot.username} (ID: ${bot.id})`);
    } else {
        const passwordHash = await bcrypt.hash(botPassword, 10);
        bot = await prisma.user.create({
            data: {
                email: botEmail,
                username: botUsername,
                password_hash: passwordHash,
                peer_id: botPeerId,
                is_active: true,
                is_verified: true,
            }
        });
        console.log(`Bot created: ${bot.username} (ID: ${bot.id})`);
    }

    // 2. Add to Main Channel as OP
    const mainChannelId = '00000000-0000-0000-0000-000000000001';

    const mainChannel = await prisma.conversation.findUnique({
        where: { id: mainChannelId }
    });

    if (mainChannel) {
        const existingMember = await prisma.conversationMember.findUnique({
            where: {
                conversation_id_user_id: {
                    conversation_id: mainChannelId,
                    user_id: bot.id,
                }
            }
        });

        if (existingMember) {
            await prisma.conversationMember.update({
                where: {
                    conversation_id_user_id: {
                        conversation_id: mainChannelId,
                        user_id: bot.id,
                    }
                },
                data: { role: 'owner' }
            });
        } else {
            await prisma.conversationMember.create({
                data: {
                    conversation_id: mainChannelId,
                    user_id: bot.id,
                    role: 'owner',
                }
            });
        }
        console.log('Bot added/updated in Main Channel as Operator (@)');
    } else {
        console.warn('Main channel not found! Bot not added to channel.');
    }

    console.log('--- Seeding Complete ---');
    console.log('Invite Code (Peer ID):', botPeerId);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
