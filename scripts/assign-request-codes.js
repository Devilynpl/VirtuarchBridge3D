const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfill() {
    console.log("Rozpoczynanie generowania kluczy dostępu dla zarejestrowanych już użytkowników...");
    const users = await prisma.user.findMany({
        where: {
            OR: [
                { indie_request_code: null },
                { studio_request_code: null }
            ]
        }
    });

    for (const user of users) {
        const generateRequestCode = (tier) => `${tier}_${Math.random().toString(36).substring(2, 6).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const indieRequestCode = generateRequestCode("INDIE");
        const studioRequestCode = generateRequestCode("STUDIO");

        await prisma.user.update({
            where: { id: user.id },
            data: {
                indie_request_code: indieRequestCode,
                studio_request_code: studioRequestCode,
            }
        });
        console.log(`Zaktualizowano użytkownika: ${user.username}`);
    }

    console.log(`Zakończono! Zaktualizowano ${users.length} kont.`);
    await prisma.$disconnect();
}

backfill();
