const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const submissions = await prisma.submission.findMany({ take: 5 });
  console.log(submissions);
}
check().catch(console.error).finally(() => prisma.$disconnect());
