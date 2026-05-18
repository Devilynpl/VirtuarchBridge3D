const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function generate() {
    const tier = process.argv[2]; // INDIE or STUDIO
    const channelName = process.argv[3];
    const amount = parseInt(process.argv[4]) || 1;

    if (!["INDIE", "STUDIO", "TRIAL_INDIE_24H", "TRIAL_STUDIO_24H"].includes(tier) || !channelName) {
        console.error("Użycie: node generate-licenses.js <INDIE|STUDIO|TRIAL_INDIE_24H|TRIAL_STUDIO_24H> <NAZWA_KANALU> [ILOSC]");
        process.exit(1);
    }

    try {
        console.log(`Generowanie ${amount} kluczy dla: ${channelName} (${tier})...`);
        for (let i = 0; i < amount; i++) {
            const countResponse = await prisma.activationCode.count({ where: { tier: tier.startsWith('TRIAL_INDIE') ? 'INDIE' : tier.startsWith('TRIAL_STUDIO') ? 'STUDIO' : tier, channel: channelName } });
            const nextNum = countResponse + 1;
            const numStr = nextNum.toString().padStart(4, '0');

            let operator = tier === "INDIE" ? "*" : "_";
            let code = `${tier}_${channelName}${operator}${numStr}`;
            let realTier = tier;

            if (tier === "TRIAL_INDIE_24H") {
                code = `Trial-Indie-24h-${numStr}`;
                realTier = "INDIE"; // Or a specific TRIAL tier if needed
            } else if (tier === "TRIAL_STUDIO_24H") {
                code = `Trial-Studio-24h-${numStr}`;
                realTier = "STUDIO";
            }

            await prisma.activationCode.create({
                data: {
                    code,
                    tier: realTier,
                    channel: channelName,
                    is_used: false
                }
            });

            console.log(`[SUKCES] Wygenerowano kod: ${code}`);
        }
    } catch (error) {
        console.error("Błąd podczas generowania kluczy:", error);
    } finally {
        await prisma.$disconnect();
    }
}

generate();
