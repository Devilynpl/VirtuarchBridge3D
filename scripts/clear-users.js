const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearUsers() {
    console.log("Rozpoczynam usuwanie WSZYSTKICH użytkowników z bazy danych...");
    try {
        const result = await prisma.user.deleteMany({});
        console.log(`Zakończono! Usunięto ${result.count} kont użytkowników.`);
    } catch (error) {
        console.error("Wystąpił błąd podczas usuwania:", error);
    } finally {
        await prisma.$disconnect();
    }
}

clearUsers();
