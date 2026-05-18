const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const pass = 'password123';
  const hash = await bcrypt.hash(pass, 10);
  
  const user = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {
      password_hash: hash,
      is_verified: true,
      is_active: true
    },
    create: {
      email: 'test@example.com',
      username: 'testuser',
      password_hash: hash,
      is_verified: true,
      is_active: true
    }
  });
  
  console.log('Created/Updated user:', user.email, 'Password:', pass);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
