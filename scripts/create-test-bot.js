const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const path = require('path');
const fs = require('fs');

async function main() {
    // 1. Create or get Bot User
    const bot = await prisma.user.upsert({
        where: { email: 'bot@cbridge.test' },
        update: {},
        create: {
            username: 'Megabot',
            email: 'bot@cbridge.test',
            password_hash: 'hashed_password_placeholder', // Bot doesn't need to login
            peer_id: 'megabot-peer-id'
        }
    });

    console.log(`Bot created: ${bot.username} (${bot.id})`);

    // 2. Create dummy assets
    const dummyAssets = [
        { name: 'Ancient Rock', type: 'Surface', categories: ['Rock'], tags: ['mossy', 'forest'] },
        { name: 'Nordic Pine', type: '3dplant', categories: ['Forest'], tags: ['tree', 'green'] },
        { name: 'CGI Bridge Addon', type: 'addon', categories: ['Tools'], tags: ['productivity'] }
    ];

    await prisma.userAsset.deleteMany({ where: { user_id: bot.id } });

    const sharedThumbsDir = path.join(process.cwd(), 'public', 'shared-thumbs', bot.id);
    if (!fs.existsSync(sharedThumbsDir)) {
        fs.mkdirSync(sharedThumbsDir, { recursive: true });
    }

    const assetData = [];
    for (const [index, asset] of dummyAssets.entries()) {
        const assetId = `bot_asset_${index}`;
        const thumbFileName = `${assetId}.jpg`;
        const thumbPath = path.join(sharedThumbsDir, thumbFileName);

        // Create a dummy colored square for thumbnail
        // In a real scenario we'd copy a real image
        // Since I don't have an easy way to generate a real JPG from node without deps, 
        // I'll just leave it and the UI will show a placeholder or let's try to find an existing image to copy
        const existingLogo = path.join(process.cwd(), 'public', 'logo.png');
        if (fs.existsSync(existingLogo)) {
            fs.copyFileSync(existingLogo, thumbPath);
        }

        assetData.push({
            user_id: bot.id,
            asset_id: assetId,
            name: asset.name,
            type: asset.type,
            categories: asset.categories,
            tags: asset.tags,
            thumbnail: `/shared-thumbs/${bot.id}/${thumbFileName}`
        });
    }

    await prisma.userAsset.createMany({ data: assetData });
    console.log(`Created ${assetData.length} assets for Megabot`);

    // 3. Make Megabot a contact for all existing users so they see him
    const users = await prisma.user.findMany({ where: { NOT: { id: bot.id } } });
    for (const user of users) {
        await prisma.userContact.upsert({
            where: {
                user_id_contact_id: {
                    user_id: user.id,
                    contact_id: bot.id
                }
            },
            update: {},
            create: {
                user_id: user.id,
                contact_id: bot.id
            }
        });
    }

    console.log(`Megabot is now a contact for ${users.length} users`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
