const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const res = await prisma.student.create({
      data: {
        rollNumber: "TEST-123",
        name: "Test User",
        branch: "CSE",
        semester: "1",
        section: "A",
        mentor: "Mentor",
        url: "https://leetcode.com/test",
        status: "pending"
      }
    });
    console.log("Success!", res);
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
